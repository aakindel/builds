import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

export const phaseTimeouts = Object.freeze({
  preparation: 600_000,
  "convex-keygen": 15_000,
  "convex-start": 60_000,
  "convex-env": 60_000,
  "convex-deploy": 180_000,
  "convex-export": 120_000,
  "convex-import": 120_000,
  "server-start": 180_000,
  localhost: 180_000,
  cleanup: 20_000,
});
let boot;
function query(args, deadline = Date.now() + 2000) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Process inspection deadline exceeded.");
  const result = spawnSync("/bin/ps", args, {
    encoding: "utf8",
    timeout: Math.min(2000, remaining),
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error("Cannot inspect process identity.");
  return result.stdout.trim();
}
export function bootIdentity() {
  if (boot) return boot;
  if (process.platform === "linux")
    boot = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  else {
    const result = spawnSync("/usr/sbin/sysctl", ["-n", "kern.boottime"], {
      encoding: "utf8",
      timeout: 2000,
    });
    if (result.status !== 0) return null;
    boot = result.stdout.trim();
  }
  return boot;
}
export function processIdentity(pid, token, role = "supervisor", deadline) {
  if (!Number.isInteger(pid) || pid <= 1) return null;
  try {
    const value = query(
      ["-p", String(pid), "-o", "pid=,ppid=,pgid=,lstart=,comm="],
      deadline
    );
    const match = value.match(
      /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/
    );
    if (!match || !bootIdentity()) return null;
    let executable;
    if (process.platform === "linux")
      executable = fs.realpathSync(`/proc/${pid}/exe`);
    else {
      const remaining = (deadline ?? Date.now() + 2000) - Date.now();
      if (remaining <= 0) return null;
      const images = spawnSync(
        "/usr/sbin/lsof",
        ["-a", "-p", String(pid), "-d", "txt", "-Fn"],
        {
          encoding: "utf8",
          timeout: Math.min(2000, remaining),
          maxBuffer: 2 * 1024 * 1024,
        }
      );
      if (images.status !== 0) return null;
      executable = images.stdout
        .split("\n")
        .find((line) => line.startsWith("n"))
        ?.slice(1);
      if (!executable) return null;
      executable = fs.realpathSync(executable);
    }
    const binary = fs.statSync(executable);
    return {
      pid,
      binary: `${binary.dev}:${binary.ino}`,
      parent: Number(match[2]),
      pgid: Number(match[3]),
      start: match[4],
      executable,
      boot: bootIdentity(),
      token: token ?? null,
      role,
    };
  } catch {
    return null;
  }
}
function hasToken(pid, token, deadline) {
  if (!token) return false;
  try {
    const environment =
      process.platform === "linux"
        ? fs.readFileSync(`/proc/${pid}/environ`, "utf8")
        : query(["eww", "-p", String(pid), "-o", "command="], deadline);
    return environment.includes(`AGENT_BROWSER_TOKEN=${token}`);
  } catch {
    return false;
  }
}
export function createProcessAnchor(file) {
  const fd = fs.openSync(file, "wx+", 0o600);
  fs.writeSync(fd, JSON.stringify({ pid: process.pid }));
  const stat = fs.fstatSync(fd);
  return { file, fd, inode: stat.ino, device: stat.dev };
}
function hasAnchor(pid, anchor, deadline) {
  if (!anchor || !Number.isInteger(anchor.fd)) return false;
  try {
    const current = fs.lstatSync(anchor.file);
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.ino !== anchor.inode ||
      current.dev !== anchor.device
    )
      return false;
    if (process.platform === "linux")
      return fs.realpathSync(`/proc/${pid}/fd/${anchor.fd}`) === anchor.file;
    const remaining = (deadline ?? Date.now() + 2000) - Date.now();
    if (remaining <= 0) return false;
    const result = spawnSync(
      "/usr/sbin/lsof",
      ["-a", "-p", String(pid), "-d", String(anchor.fd), "-Fn"],
      { encoding: "utf8", timeout: Math.min(2000, remaining) }
    );
    return (
      result.status === 0 &&
      result.stdout.split("\n").includes("n" + anchor.file)
    );
  } catch {
    return false;
  }
}
function hasProfile(pid, profile, deadline) {
  if (!profile) return false;
  try {
    return query(
      ["ww", "-p", String(pid), "-o", "command="],
      deadline
    ).includes("--user-data-dir=" + profile);
  } catch {
    return false;
  }
}
export function mergeResource(previous, current) {
  return previous &&
    previous.boot === current.boot &&
    previous.start === current.start &&
    previous.binary === current.binary
    ? {
        ...previous,
        ...current,
        role:
          ["node", "child", "descendant"].includes(current.role) &&
          !["node", "child", "descendant"].includes(previous.role)
            ? previous.role
            : current.role,
        anchor: current.anchor ?? previous.anchor,
        profile: current.profile ?? previous.profile,
      }
    : current;
}
export function identityState(record, deadline) {
  if (
    !record?.boot ||
    !record.start ||
    !record.executable ||
    !record.binary ||
    !Number.isInteger(record.pid) ||
    record.pid <= 1
  )
    return "uncertain";
  const currentBoot = bootIdentity();
  if (!currentBoot) return "uncertain";
  if (record.boot !== currentBoot) return "dead";
  try {
    process.kill(record.pid, 0);
  } catch (error) {
    return error.code === "ESRCH" ? "dead" : "uncertain";
  }
  const current = processIdentity(
    record.pid,
    undefined,
    "supervisor",
    deadline
  );
  if (!current) return "uncertain";
  if (
    record.start !== current.start ||
    record.executable !== current.executable ||
    record.binary !== current.binary ||
    record.pgid !== current.pgid
  )
    return "reused";
  // Parents may legitimately exit. Children need their run token as additional ownership proof.
  if (record.anchor && hasAnchor(record.pid, record.anchor, deadline))
    return "live";
  if (record.role === "supervisor")
    return record.parent === current.parent ? "live" : "uncertain";
  if (
    !hasToken(record.pid, record.token, deadline) &&
    !hasProfile(record.pid, record.profile, deadline)
  )
    return "uncertain";
  return "live";
}
export function groupState(pgid) {
  if (!Number.isInteger(pgid) || pgid <= 1)
    throw new Error("Invalid owned process group.");
  try {
    process.kill(-pgid, 0);
    return "live";
  } catch (error) {
    return error.code === "ESRCH" ? "dead" : "uncertain";
  }
}
function discover(resources, token, deadline) {
  if (!token) return resources;
  try {
    const groups = new Set(
      resources
        .filter((item) => item?.pid === item?.pgid)
        .map((item) => item.pgid)
    );
    const parents = new Set(resources.map((item) => item?.pid).filter(Boolean));
    const rows = query(["-A", "-o", "pid=,ppid=,pgid="], deadline)
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number));
    const found = new Map(
      resources.filter(Boolean).map((item) => [item.pid, item])
    );
    for (let pass = 0; pass < 5; pass++)
      for (const [pid, parent, pgid] of rows) {
        if (
          !found.has(pid) &&
          (groups.has(pgid) || parents.has(parent)) &&
          hasToken(pid, token, deadline)
        ) {
          const identity = processIdentity(pid, token, "descendant", deadline);
          if (identity) {
            found.set(pid, identity);
            parents.add(pid);
          }
        }
      }
    return [...found.values()];
  } catch (error) {
    throw new Error("Cannot discover owned descendants: " + error.message, {
      cause: error,
    });
  }
}
export async function cleanupResources(
  initial,
  {
    cleanup = 20_000,
    deadline = Date.now() + cleanup,
    token,
    onResources = () => {},
    env,
    inspectRecord = identityState,
    signalProcess = (pid, signal) => process.kill(pid, signal),
    discoverProcesses = discover,
  } = {}
) {
  let resources = initial.filter(Boolean);
  let discoveryError;
  const inspect = () => {
    try {
      resources = discoverProcesses(resources, token, deadline);
      discoveryError = undefined;
    } catch (error) {
      discoveryError = error.message;
    }
    onResources(resources);
    const states = resources.map((record) => inspectRecord(record, deadline));
    return discoveryError || states.includes("uncertain")
      ? "uncertain"
      : states.includes("live")
        ? "live"
        : "dead";
  };
  const signalled = { SIGTERM: new Set(), SIGKILL: new Set() };
  const send = (signal) => {
    for (const record of [...resources].reverse()) {
      const key = JSON.stringify([
        record.boot,
        record.pid,
        record.start,
        record.executable,
        record.binary,
      ]);
      if (
        Date.now() < deadline &&
        !signalled[signal].has(key) &&
        inspectRecord(record, deadline) === "live" &&
        Date.now() < deadline
      ) {
        try {
          signalled[signal].add(key);
          signalProcess(record.pid, signal);
        } catch {
          /* Final inspection remains authoritative. */
        }
      }
    }
  };
  let state = inspect();
  if (state !== "dead") {
    if (env) deadline = Math.min(deadline, sharedCleanupDeadline(env, cleanup));
    send("SIGTERM");
    const killAt = Math.max(Date.now(), deadline - Math.min(5000, cleanup / 4));
    while (Date.now() < deadline && inspect() !== "dead") {
      // Shutdown may create a new descendant after the initial TERM. Signal
      // each proven identity once per phase, as soon as it is discovered.
      send("SIGTERM");
      if (Date.now() >= killAt) send("SIGKILL");
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(1, Math.min(100, deadline - Date.now())))
      );
    }
    state = inspect();
  }
  return { cleanup: state, resources, cleanupError: discoveryError };
}
export function readEvents(file, { live = false } = {}) {
  if (!file || !fs.existsSync(file)) return [];
  if (fs.lstatSync(file).isSymbolicLink())
    throw new Error("Ownership records must not be symlinks.");
  const contents = fs.readFileSync(file, "utf8");
  const lines = contents.split("\n");
  // A writer may be between its bytes and terminating newline. Only monitoring
  // tolerates that unfinished tail; final results and recovery require it complete.
  if (live && !contents.endsWith("\n")) lines.pop();
  return lines.filter(Boolean).map(JSON.parse);
}
export function completeIntent(intent, records) {
  if (
    records.some(
      (item) =>
        item.intent === intent.intent &&
        ["resource", "spawn-error", "reaped"].includes(item.type)
    )
  )
    return true;
  const spawned = records.find(
    (item) => item.type === "spawned" && item.intent === intent.intent
  );
  if (!spawned) return false;
  // A Node child may outlive a parent that exits before its spawn callback.
  // Its own anchored receipt completes the synchronous kernel spawn receipt.
  return records.some(
    (item) =>
      item.type === "resource" &&
      item.identity?.pid === spawned.pid &&
      item.identity.boot === spawned.boot &&
      item.identity.token === spawned.token &&
      item.identity.anchor &&
      item.identity.executable === spawned.nodeExecutable &&
      Date.parse(item.identity.start) >= spawned.at - 2000 &&
      Date.parse(item.identity.start) <= spawned.at + 1000
  );
}
export function sharedCleanupDeadline(env = process.env, cleanup = 20_000) {
  const file = env.AGENT_BROWSER_STAGE_FILE?.replace(
    /\.json$/,
    ".cleanup.json"
  );
  if (!file) return Date.now() + cleanup;
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new Error("Unsafe cleanup deadline.");
  try {
    fs.writeFileSync(file, JSON.stringify({ deadline: Date.now() + cleanup }), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const { deadline } = JSON.parse(fs.readFileSync(file));
  if (!Number.isFinite(deadline)) throw new Error("Invalid cleanup deadline.");
  return deadline;
}
export async function runOwned(
  command,
  {
    cwd,
    env,
    timeout = 900_000,
    cleanup = 20_000,
    onOutput = () => {},
    onSpawn = () => {},
    onResources = () => {},
    shareCleanup = true,
  }
) {
  if (process.platform === "win32")
    throw new Error("Owned verification requires macOS or Linux.");
  if (!processIdentity(process.pid))
    throw new Error(
      "Cannot inspect process ownership before startup; host review is required."
    );
  const token = env.AGENT_BROWSER_TOKEN ?? randomUUID();
  env = { ...env, AGENT_BROWSER_TOKEN: token };
  const processFile = env.AGENT_BROWSER_STAGE_FILE?.replace(
    /\.json$/,
    ".processes.jsonl"
  );
  const eventFile = env.AGENT_BROWSER_STAGE_FILE?.replace(
    /\.json$/,
    ".events.jsonl"
  );
  const child = spawn(command[0], command.slice(1), {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    failure,
    diagnostic,
    code,
    signal,
    closed = false,
    mainExited = false,
    uncertain = false,
    missingWrapperIdentity = false;
  let resources = [];
  const phases = new Map();
  let eventCount = 0;
  let wake;
  const completion = new Promise((resolve) => {
    wake = resolve;
  });
  let closeResolve;
  const closedCompletion = new Promise((resolve) => {
    closeResolve = resolve;
  });
  const stop = (reason, event) => {
    if (!failure)
      diagnostic = event
        ? {
            phase: event.phase,
            component: event.component,
            code: event.error?.code,
          }
        : undefined;
    failure ??= reason;
    wake();
  };
  const interrupt = () => stop("Verification interrupted.");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const collect = (live = true) => {
    const records = readEvents(processFile, { live });
    if (
      !live &&
      records.some(
        (item) => item.type === "intent" && !completeIntent(item, records)
      )
    ) {
      uncertain = true;
      stop("Interrupted spawn has no complete ownership receipt.");
    }
    const identities = records
      .filter((item) => item.type === "resource")
      .map((item) => item.identity)
      .filter((item) => item?.token === token);
    // Nested lifecycle commands share the ledger, but never own the invoking
    // wrapper, their own process, siblings or ancestors. Follow only this
    // direct child, its detached group and recorded descendant chains.
    const descendants = new Set([
      child.pid,
      ...resources.map((item) => item.pid),
      ...(shareCleanup ? identities.map((item) => item.pid) : []),
    ]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of identities) {
        if (
          !descendants.has(item.pid) &&
          (descendants.has(item.parent) || item.pgid === child.pid)
        ) {
          descendants.add(item.pid);
          changed = true;
        }
      }
    }
    const byPID = new Map();
    for (const item of [
      ...resources,
      ...identities.filter((item) => descendants.has(item.pid)),
    ].filter(Boolean))
      byPID.set(item.pid, mergeResource(byPID.get(item.pid), item));
    resources = [...byPID.values()];
    onResources(resources);
    const events = readEvents(eventFile, { live });
    for (const event of events
      .slice(eventCount)
      .filter(
        (item) => descendants.has(item.pid) || item.pid === process.pid
      )) {
      const key = `${event.pid}:${event.component}`;
      if (event.error && event.fatal !== false)
        stop(event.error.message, event);
      phases.set(key, event);
    }
    eventCount = events.length;
    for (const event of phases.values()) {
      // A retained optional-copy failure is a completed phase, not a running
      // clock. Fatal errors were already handled above and stay the cause.
      if (event.error) continue;
      const limit =
        event.phase === "chromium-launch"
          ? env.AGENT_BROWSER_ROUTE === "reviewed"
            ? 60_000
            : 30_000
          : phaseTimeouts[event.phase];
      if (limit && Date.now() - event.at > limit)
        stop(`${event.component} ${event.phase} deadline exceeded.`, event);
    }
  };
  const timer = setTimeout(
    () => stop("Verification execution deadline exceeded."),
    timeout
  );
  const monitor = setInterval(() => {
    try {
      collect();
    } catch (error) {
      uncertain = true;
      stop("Cannot inspect ownership: " + error.message);
    }
  }, 250);
  child.once("spawn", () => {
    const identity = processIdentity(child.pid, token, "wrapper");
    if (identity) resources.push(identity);
    else missingWrapperIdentity = true;
    try {
      onSpawn(child.pid, identity);
      onResources(resources);
    } catch (error) {
      stop("Cannot retain ownership: " + error.message);
    }
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (bytes) => {
      const value = bytes
        .toString()
        .replace(
          /(--(?:admin-key|instance-secret)(?:=|\s+))[^\s]+/g,
          "$1[redacted]"
        );
      output = (output + value).slice(-2 * 1024 * 1024);
      try {
        onOutput(value);
      } catch (error) {
        stop("Cannot retain output: " + error.message);
      }
    });
  child.once("error", (error) => stop(error.message));
  child.once("exit", (exitCode, exitSignal) => {
    code = exitCode;
    signal = exitSignal;
    mainExited = true;
    wake();
  });
  child.once("close", (exitCode, exitSignal) => {
    code = exitCode;
    signal = exitSignal;
    closed = true;
    closeResolve();
    wake();
  });
  await completion;
  // Exit reaps the exact child. Close can wait indefinitely for an orphan that
  // inherited a pipe. Drain ordinary buffered output briefly, then supervise
  // those descendants within the shared cleanup budget.
  if (mainExited && !closed)
    await Promise.race([
      closedCompletion,
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
  clearTimeout(timer);
  clearInterval(monitor);
  try {
    if (shareCleanup) {
      collect(true);
      const pending = () => {
        const records = readEvents(processFile, { live: true });
        return records.some(
          (item) => item.type === "intent" && !completeIntent(item, records)
        );
      };
      if (pending()) {
        const deadline = Math.min(
          Date.now() + 2000,
          sharedCleanupDeadline(env, cleanup)
        );
        while (pending() && Date.now() < deadline) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(100, deadline - Date.now()))
          );
          collect(true);
        }
      }
    }
    collect(!shareCleanup);
  } catch (error) {
    uncertain = true;
    failure ??= "Cannot inspect ownership: " + error.message;
  }
  // The close event proves this exact direct child was reaped, even when a
  // short native command exited before ps/lsof could obtain its identity.
  if (missingWrapperIdentity && !mainExited && !closed) uncertain = true;
  const outcome = await cleanupResources(resources, {
    env:
      shareCleanup ||
      ((failure || code !== 0) && env.AGENT_BROWSER_OPTIONAL_PHASE !== "1")
        ? env
        : undefined,
    cleanup,
    token,
    onResources,
  });
  if (!closed) {
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  return {
    ok: !failure && !uncertain && code === 0 && outcome.cleanup === "dead",
    code,
    signal,
    error:
      failure ??
      (outcome.cleanup !== "dead"
        ? (outcome.cleanupError ?? "Owned cleanup remains " + outcome.cleanup)
        : undefined),
    diagnostic:
      diagnostic ??
      (outcome.cleanup !== "dead"
        ? { phase: "cleanup", component: "supervisor" }
        : undefined),
    output,
    pgid: child.pid,
    groups: [...new Set(outcome.resources.map((item) => item.pgid))],
    resources: outcome.resources,
    cleanup: uncertain ? "uncertain" : outcome.cleanup,
  };
}
