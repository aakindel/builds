import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupResources,
  completeIntent,
  createProcessAnchor,
  identityState,
  mergeResource,
  processIdentity,
} from "./verification-process.mjs";

export const requestVersion = 2;
export const workflowUUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function safePath(root, relative, create = false) {
  const destination = path.resolve(root, relative);
  if (!destination.startsWith(root + path.sep))
    throw new Error("State path escapes its root.");
  let current = root;
  const parts = path.relative(root, destination).split(path.sep);
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat) {
      if (
        stat.isSymbolicLink() ||
        (index < parts.length - 1 && !stat.isDirectory())
      )
        throw new Error("Unsafe state path: " + current);
    } else if (create && index < parts.length - 1)
      fs.mkdirSync(current, { mode: 0o700 });
  }
  return destination;
}
export function readJSON(file) {
  if (fs.lstatSync(file).isSymbolicLink())
    throw new Error("State records must not be symlinks.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function atomicJSON(file, value) {
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new Error("State records must not be symlinks.");
  const temporary = file + "." + randomUUID();
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  try {
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
export function controlReceipt(root, relative) {
  if (
    ![
      "zlocal/.agent-start.lock",
      "zlocal/.agent-owner.json",
      ".next-agent/dev/lock",
      ".next-e2e/dev/lock",
    ].includes(relative)
  )
    throw new Error("Unsupported server control.");
  const file = safePath(root, relative);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() && !stat.isDirectory())
    throw new Error("Invalid server control type.");
  const content = stat.isDirectory()
    ? fs
        .readdirSync(file)
        .sort()
        .map((name) => {
          const item = safePath(root, relative + "/" + name);
          if (!fs.statSync(item).isFile())
            throw new Error("Unknown startup-lock content.");
          return [name, fs.readFileSync(item, "utf8")];
        })
    : fs.readFileSync(file);
  return {
    path: relative,
    inode: stat.ino,
    device: stat.dev,
    birth: stat.birthtimeMs,
    directory: stat.isDirectory(),
    digest: createHash("sha256")
      .update(stat.isDirectory() ? JSON.stringify(content) : content)
      .digest("hex"),
  };
}
export function requestPath(root, id, create = false) {
  if (!workflowUUID.test(id ?? ""))
    throw new Error("Expected a workflow UUID.");
  return safePath(root, `zlocal/agent-browser/requests/${id}.json`, create);
}
export function loadRequest(root, id) {
  const file = requestPath(root, id);
  const request = readJSON(file);
  if (
    request.version !== requestVersion ||
    request.id !== id ||
    request.root !== root ||
    !Array.isArray(request.attempts)
  )
    throw new Error(
      "Workflow identity or schema changed; inspect or migrate its record."
    );
  return { request, file };
}
export function saveRequest(root, request) {
  atomicJSON(requestPath(root, request.id, true), request);
}
export function acquireLock(root, name, id) {
  const file = safePath(root, `zlocal/agent-browser/${name}.lock`, true);
  const token = randomUUID();
  const anchorFile = safePath(
    root,
    `zlocal/agent-browser/anchors/${token}.anchor`,
    true
  );
  const anchor = createProcessAnchor(anchorFile);
  // O_EXCL publishes the owner in one write; a crash cannot leave an empty directory lock.
  const owner = {
    version: 2,
    root,
    id,
    token,
    supervisor: { ...processIdentity(process.pid), anchor },
  };
  try {
    fs.writeFileSync(file, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST" || !["recovery", "migration"].includes(name))
      throw error;
    const previous = readJSON(file);
    if (
      previous.root !== root ||
      !["dead", "reused"].includes(identityState(previous.supervisor))
    )
      throw error;
    releaseLock({ file, token: previous.token });
    fs.writeFileSync(file, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  }
  return { file, token, supervisor: owner.supervisor };
}
export function releaseLock(lock) {
  if (!fs.existsSync(lock.file)) return;
  if (readJSON(lock.file).token !== lock.token)
    throw new Error("Lock ownership changed.");
  fs.unlinkSync(lock.file);
}
export function listRequests(root) {
  const folder = safePath(root, "zlocal/agent-browser/requests");
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => workflowUUID.test(name.replace(/\.json$/, "")))
    .map((name) => loadRequest(root, name.replace(/\.json$/, "")).request);
}
function mergeResources(attempt) {
  const resources = new Map(
    (attempt.resources ?? []).map((item) => [item.pid, item])
  );
  if (attempt.processFile && fs.existsSync(attempt.processFile)) {
    for (const line of fs
      .readFileSync(attempt.processFile, "utf8")
      .split("\n")
      .filter(Boolean)) {
      const item = JSON.parse(line);
      if (item.type === "resource")
        resources.set(
          item.identity.pid,
          mergeResource(resources.get(item.identity.pid), item.identity)
        );
    }
  }
  return [...resources.values()];
}
export function inspectRecovery(root, request) {
  const attempt = request.activePreparation ?? request.attempts.at(-1);
  if (!attempt || attempt.cleanup === "dead")
    return { state: "settled", resources: [] };
  const supervisor = identityState(attempt.supervisor);
  if (supervisor === "live") return { state: "active", resources: [] };
  if (supervisor === "uncertain")
    return {
      state: "blocked",
      reason: "Supervisor identity cannot be proven.",
    };
  const resources = mergeResources(attempt);
  // Spawn intent without a receipt can hide a detached child: retain, never invent ownership.
  const events =
    attempt.processFile && fs.existsSync(attempt.processFile)
      ? fs
          .readFileSync(attempt.processFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map(JSON.parse)
      : [];
  if (
    events.some(
      (item) => item.type === "intent" && !completeIntent(item, events)
    )
  )
    return {
      state: "blocked",
      reason: "An interrupted spawn has no complete ownership receipt.",
      resources,
    };
  if (attempt.spawnIntent || !resources.length)
    return {
      state: "blocked",
      reason: "Interrupted verification has no complete ownership record.",
      resources,
    };
  const states = resources.map((record) => identityState(record));
  if (states.includes("uncertain"))
    return {
      state: "blocked",
      reason: "Child identity is incomplete or cannot be inspected.",
      resources,
    };
  return { state: states.includes("live") ? "abandoned" : "dead", resources };
}
export async function recoverRequest(root, id, options = {}) {
  const lock = acquireLock(root, "recovery", id);
  try {
    const { request } = loadRequest(root, id);
    const inspection = inspectRecovery(root, request);
    if (["blocked", "active"].includes(inspection.state))
      return {
        ...request,
        recovery: inspection,
        nextAction:
          inspection.state === "active"
            ? "Wait for the valid supervisor."
            : "Inspect retained ownership; do not signal numeric PIDs.",
      };
    const attempt = request.activePreparation ?? request.attempts.at(-1);
    if (["abandoned", "dead"].includes(inspection.state)) {
      const outcome = await cleanupResources(inspection.resources, {
        ...options,
        token: attempt.token,
      });
      if (outcome.cleanup !== "dead") {
        attempt.cleanup = outcome.cleanup;
        request.status = "cleanup-pending";
        request.nextAction =
          "Owned children did not exit within 20 seconds. Retain evidence for OS recovery; do not relaunch or reboot automatically.";
        saveRequest(root, request);
        return request;
      }
    }
    if (attempt && inspection.state !== "settled") {
      attempt.cleanup = "dead";
      attempt.resources = inspection.resources;
      request.status =
        !request.reviewConsumed &&
        attempt.route === "sandbox" &&
        attempt.failure?.retryEligible
          ? "review-required"
          : "interrupted";
      request.nextRoute =
        request.status === "review-required" ? "reviewed" : null;
      request.pendingAction = request.nextRoute ? "execution" : null;
      request.retryCommand = request.nextRoute
        ? ["pnpm", "agents:browser", "reviewed", id]
        : null;
      saveRequest(root, request);
    }
    const active = safePath(root, "zlocal/agent-browser/active.lock");
    if (fs.existsSync(active)) {
      const owner = readJSON(active);
      if (
        owner.id === id &&
        ["dead", "reused"].includes(identityState(owner.supervisor))
      )
        releaseLock({ file: active, token: owner.token });
    }
    // Only remove associated server/build controls after every owned resource is dead.
    for (const receipt of attempt?.controls ?? []) {
      const file = safePath(root, receipt.path);
      if (
        fs.existsSync(file) &&
        JSON.stringify(controlReceipt(root, receipt.path)) ===
          JSON.stringify(receipt)
      )
        fs.rmSync(file, { recursive: true });
    }
    return { ...request, recovery: { state: "reconciled" } };
  } finally {
    releaseLock(lock);
  }
}
export function releaseControls(root, attempt) {
  if (attempt?.cleanup !== "dead") return;
  for (const receipt of attempt.controls ?? []) {
    const file = safePath(root, receipt.path);
    if (
      fs.existsSync(file) &&
      JSON.stringify(controlReceipt(root, receipt.path)) ===
        JSON.stringify(receipt)
    )
      fs.rmSync(file, { recursive: true });
  }
}
export async function reconcileBeforeRun(root) {
  if (migrationPlan(root).changes.length)
    throw new Error(
      "Legacy workflow records need explicit state migration before startup: agents:browser migrate, then migrate --apply."
    );
  for (const request of listRequests(root)) {
    const inspection = inspectRecovery(root, request);
    if (
      inspection.state === "settled" &&
      !(request.attempts.at(-1)?.controls ?? []).some((receipt) =>
        fs.existsSync(safePath(root, receipt.path))
      )
    )
      continue;
    const result = await recoverRequest(root, request.id);
    if (
      ["blocked", "active"].includes(result.recovery?.state) ||
      result.status === "cleanup-pending"
    )
      throw new Error(
        `Prior verification ${request.id} blocks startup: ${result.nextAction ?? result.recovery.reason}`
      );
  }
  const active = safePath(root, "zlocal/agent-browser/active.lock");
  if (fs.existsSync(active))
    throw new Error(
      "An active or interrupted workflow lock needs recovery before startup."
    );
  const legacy = safePath(
    root,
    "zlocal/artifacts/browser-workflow/active.lock"
  );
  if (fs.existsSync(legacy))
    throw new Error(
      "Legacy workflow lock needs explicit state migration before startup."
    );
}
export function migrationPlan(root) {
  const base = safePath(root, "zlocal/artifacts/browser-workflow");
  const changes = [];
  if (fs.existsSync(base))
    for (const name of fs
      .readdirSync(base)
      .filter((name) => workflowUUID.test(name))) {
      const source = safePath(
        root,
        `zlocal/artifacts/browser-workflow/${name}/request.json`
      );
      if (!fs.existsSync(source)) continue;
      const value = readJSON(source);
      if (value.root !== root || value.id !== name)
        throw new Error("Legacy record belongs to another project.");
      const target = requestPath(root, name);
      if (fs.existsSync(target)) {
        const existing = loadRequest(root, name).request;
        if (
          existing.legacyDigest !==
          createHash("sha256").update(fs.readFileSync(source)).digest("hex")
        )
          throw new Error(
            "Customized migration destination preserved: " + target
          );
        continue;
      }
      changes.push({
        source,
        target,
        value: {
          ...value,
          version: 2,
          status: value.attempts?.some((attempt) => attempt.cleanup !== "dead")
            ? "blocked"
            : value.status,
          reviewConsumed:
            value.attempts?.some((attempt) => attempt.route === "reviewed") ??
            false,
          legacy: true,
          legacyDigest: createHash("sha256")
            .update(fs.readFileSync(source))
            .digest("hex"),
        },
      });
    }
  return { version: 1, root, changes };
}
export function migrateState(root, apply = false, rollback = false) {
  const journal = safePath(root, "zlocal/agent-browser/migration.json");
  if (rollback) {
    const lock = acquireLock(root, "migration", "migration");
    try {
      const record = readJSON(journal);
      for (const item of record.targets)
        if (
          fs.existsSync(item.file) &&
          createHash("sha256")
            .update(fs.readFileSync(item.file))
            .digest("hex") !== item.digest
        )
          throw new Error(
            "Changed migration destination preserved: " + item.file
          );
      for (const item of record.targets) fs.rmSync(item.file, { force: true });
      atomicJSON(journal, { ...record, status: "rolled-back" });
      return { root, rolledBack: true };
    } finally {
      releaseLock(lock);
    }
  }
  const plan = migrationPlan(root);
  if (!apply || !plan.changes.length) return { ...plan, applied: apply };
  const lock = acquireLock(root, "migration", "migration");
  try {
    const targets =
      fs.existsSync(journal) && readJSON(journal).status === "applying"
        ? readJSON(journal).targets
        : [];
    for (const item of plan.changes)
      if (!targets.some((previous) => previous.file === item.target))
        targets.push({
          file: item.target,
          digest: createHash("sha256")
            .update(JSON.stringify(item.value, null, 2) + "\n")
            .digest("hex"),
        });
    atomicJSON(safePath(root, "zlocal/agent-browser/migration.json", true), {
      version: 1,
      root,
      status: "applying",
      targets,
    });
    for (const item of plan.changes) saveRequest(root, item.value);
    atomicJSON(journal, { version: 1, root, status: "complete", targets });
    return { ...plan, applied: true };
  } finally {
    releaseLock(lock);
  }
}
