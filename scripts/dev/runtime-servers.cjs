// runtime-servers-managed: 1

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { setTimeout } = require("node:timers");
const { URL } = require("node:url");

const ranges = {
  dev: [3000, 3010],
  agent: [3100, 3110],
  e2e: [3120, 3130],
};

function validateOrigin(value, role) {
  const range = ranges[role];
  const match = /^http:\/\/127\.0\.0\.1:([1-9]\d*)\/?$/.exec(value ?? "");
  if (
    !range ||
    !match ||
    Number(match[1]) < range[0] ||
    Number(match[1]) > range[1]
  )
    throw new Error(
      `Invalid ${role} verification URL: ${value}. Use the isolated loopback port range.`
    );
  return new URL(value).origin;
}

function readAgentOwner(rootDir = process.cwd(), range = ranges.agent) {
  const root = fs.realpathSync(rootDir);
  const file = path.join(root, "zlocal/.agent-owner.json");
  if (!fs.existsSync(file))
    throw new Error(
      "Start pnpm dev:agent first; its ownership record is missing."
    );
  const owner = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    owner.root !== root ||
    !Number.isInteger(owner.port) ||
    owner.port < range[0] ||
    owner.port > range[1] ||
    !Number.isInteger(owner.wrapperPid) ||
    owner.wrapperPid <= 0 ||
    !Number.isInteger(owner.childPid) ||
    owner.childPid <= 0 ||
    !/^[a-f0-9]{64}$/.test(owner.token ?? "")
  )
    throw new Error(
      "Ownership record does not match this checkout or an exact port in the agent range. Nothing was stopped."
    );
  return owner;
}

function readAgentBaseURL(rootDir = process.cwd()) {
  return `http://127.0.0.1:${readAgentOwner(rootDir).port}`;
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.status === 1 && !String(error.stderr ?? "").trim()) return "";
    throw new Error(
      `Cannot inspect server ownership using ${command}. Leave processes and locks intact.`,
      { cause: error }
    );
  }
}

function inspectListeners(port) {
  const output = commandOutput("lsof", [
    "-nP",
    port === undefined ? "-iTCP" : `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-t",
  ]);
  return [...new Set(output.trim().split(/\s+/).filter(Boolean))].map((pid) => {
    const cwd = commandOutput("lsof", [
      "-a",
      "-nP",
      "-p",
      pid,
      "-d",
      "cwd",
      "-Fn",
    ])
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
    if (!cwd)
      throw new Error(
        `Cannot identify listener ${pid}; leave its processes and locks intact.`
      );
    const command = commandOutput("ps", [
      "-ww",
      "-p",
      pid,
      "-o",
      "command=",
    ]).trim();
    if (!command)
      throw new Error(
        `Cannot identify listener ${pid}; leave its processes and locks intact.`
      );
    return { pid: Number(pid), root: fs.realpathSync(cwd), command };
  });
}

function findOwnedDevPort(
  rootDir = process.cwd(),
  { start = 3000, end = 3010, inspect = inspectListeners } = {}
) {
  const root = fs.realpathSync(rootDir);
  const matches = [];
  for (let port = start; port <= end; port++) {
    if (
      inspect(port).some(
        (listener) =>
          listener.root === root &&
          /(?:next-server|(?:^|[ /])next(?:\.js)?\s+dev)/.test(listener.command)
      )
    )
      matches.push(port);
  }
  if (matches.length > 1)
    throw new Error(
      "Multiple dev servers match this checkout. Inspect them before continuing."
    );
  return matches[0] ?? null;
}

function assertNoNextProcess(
  rootDir = process.cwd(),
  {
    list = () =>
      commandOutput("pgrep", [
        "-f",
        "next-server|(^|[ /])next(\\.js)?[[:space:]]+dev|(^|[ /])(ba)?sh[[:space:]]+([^ ]*/)?scripts/(dev/agent-dev|verification/(e2e-run|e2e-web-server)|agent-dev|e2e-run|e2e-web-server)\\.sh",
      ]),
    cwd = (pid) =>
      commandOutput("lsof", ["-a", "-nP", "-p", pid, "-d", "cwd", "-Fn"])
        .split("\n")
        .find((line) => line.startsWith("n"))
        ?.slice(1),
  } = {}
) {
  const root = fs.realpathSync(rootDir);
  for (const pid of list().trim().split(/\s+/).filter(Boolean)) {
    const directory = cwd(pid);
    if (!directory)
      throw new Error(
        `Cannot identify Next process ${pid}; leave build locks intact.`
      );
    const processRoot = fs.realpathSync(directory);
    if (processRoot === root || processRoot.startsWith(`${root}${path.sep}`))
      throw new Error(
        "A Next process still owns this checkout. Leave its build lock intact."
      );
  }
}

function assertNoProjectServers(
  rootDir,
  { inspect = inspectListeners, assertNoNext = assertNoNextProcess } = {}
) {
  const root = fs.realpathSync(rootDir);
  for (const file of [
    "zlocal/.agent-owner.json",
    "zlocal/.agent-start.lock",
    ".next/dev/lock",
    ".next-agent/dev/lock",
    ".next-e2e/dev/lock",
  ]) {
    if (fs.existsSync(path.join(root, file)))
      throw new Error(
        "Stop this worktree's servers or inspect its retained ownership/build locks before cleanup. No process was killed."
      );
  }
  // Include backend listeners and processes in checkout-local subdirectories.
  // A wrapper may die during backend startup, before Next creates a build lock.
  if (
    inspect().some(
      (listener) =>
        listener.root === root || listener.root.startsWith(`${root}${path.sep}`)
    )
  )
    throw new Error(
      "Stop this worktree's live servers before cleanup. No process was killed."
    );
  assertNoNext(root);
}

function findFreePort(start, end) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end > 65535 ||
    start > end
  )
    throw new Error("Invalid port range.");
  for (let port = start; port <= end; port++) {
    if (
      !commandOutput("lsof", [
        "-nP",
        `-iTCP:${port}`,
        "-sTCP:LISTEN",
        "-t",
      ]).trim()
    )
      return port;
  }
  throw new Error(`No free port in range ${start}-${end}`);
}

function readE2eEnvironment(rootDir = process.cwd(), env = process.env) {
  const root = fs.realpathSync(rootDir);
  if (
    env.E2E_ROOT !== root ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(
      env.E2E_RUN_ID ?? ""
    ) ||
    !/^[1-9]\d*$/.test(env.E2E_LAUNCHER_PID ?? "")
  )
    throw new Error(
      "E2E requires its parent launcher. Use pnpm test:e2e with your test selections and flags."
    );
  const baseURL = validateOrigin(env.E2E_BASE_URL, "e2e");
  const result = {
    root,
    baseURL,
    runId: env.E2E_RUN_ID,
    launcherPid: Number(env.E2E_LAUNCHER_PID),
  };
  if (env.E2E_CONVEX_URL || env.E2E_CONVEX_SITE_URL) {
    const cloud = /^http:\/\/127\.0\.0\.1:([1-9]\d*)$/.exec(env.E2E_CONVEX_URL);
    const site = /^http:\/\/127\.0\.0\.1:([1-9]\d*)$/.exec(
      env.E2E_CONVEX_SITE_URL ?? ""
    );
    if (
      !cloud ||
      !site ||
      Number(cloud[1]) < 3220 ||
      Number(cloud[1]) > 3268 ||
      Number(site[1]) !== Number(cloud[1]) + 1
    )
      throw new Error("Refusing a non-isolated E2E Convex endpoint pair.");
    result.convexUrl = env.E2E_CONVEX_URL;
    result.convexSiteUrl = env.E2E_CONVEX_SITE_URL;
  }
  return result;
}

async function waitForE2e(
  rootDir,
  childPid,
  { fetch = globalThis.fetch, timeout = 180000, reportStage = () => {} } = {}
) {
  const expected = readE2eEnvironment(rootDir);
  reportStage("server-start");
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      process.kill(childPid, 0);
    } catch (error) {
      throw new Error(
        "The E2E server exited before readiness. Check its startup output.",
        { cause: error }
      );
    }
    try {
      const response = await fetch(
        `${expected.baseURL}/api/verification-health`,
        { redirect: "error", signal: globalThis.AbortSignal.timeout(2000) }
      );
      if (response.ok) {
        const identity = await response.json();
        if (
          identity.root !== expected.root ||
          identity.role !== "e2e" ||
          identity.runId !== expected.runId
        )
          throw new Error(
            "E2E startup reached another checkout, role, or run."
          );
        reportStage("next-ready");
        return;
      }
    } catch (error) {
      if (
        error.message === "E2E startup reached another checkout, role, or run."
      )
        throw error;
      if (error.cause?.code === "EPERM" || error.cause?.code === "EACCES") {
        const failure = new Error(
          `E2E readiness request failed: ${error.cause.code}`,
          { cause: error }
        );
        reportStage("server-start", failure);
        throw failure;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    "E2E server did not become ready before the startup deadline."
  );
}

module.exports = {
  ranges,
  validateOrigin,
  readAgentOwner,
  readAgentBaseURL,
  inspectListeners,
  findOwnedDevPort,
  assertNoNextProcess,
  assertNoProjectServers,
  findFreePort,
  readE2eEnvironment,
  waitForE2e,
};
