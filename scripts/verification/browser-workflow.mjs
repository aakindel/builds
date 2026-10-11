import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvironment } from "../agents/runtime/agent-runtime.mjs";
import {
  assertOperationPrerequisites,
  operationCommand,
  requiredComponents,
} from "./browser-adapters.mjs";
import {
  browserInputs,
  environmentIdentity,
  digest as hash,
  initialRoute,
  mergeCompatibilityReceipt,
  saveCompatibility,
} from "./browser-compatibility.mjs";
import { inspectPrerequisites, prepareBrowser } from "./browser-prepare.mjs";
import {
  acquireLock,
  atomicJSON,
  controlReceipt,
  loadRequest,
  migrateState,
  readJSON,
  reconcileBeforeRun,
  recoverRequest,
  releaseControls,
  releaseLock,
  safePath,
  saveRequest,
} from "./browser-state.mjs";
import { readEvents, runOwned } from "./verification-process.mjs";

export {
  operationCommand,
  assertOperationPrerequisites,
  environmentIdentity,
  initialRoute,
};
export const RETRY_REQUIRED = 75;
export function sourceFingerprint(root, operation) {
  const files = [
    "package.json",
    "pnpm-lock.yaml",
    ".agents/environment.json",
    "playwright.config.ts",
    "playwright.agent.config.ts",
    "playwright.alignment.config.ts",
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "tsconfig.json",
    "tsconfig.agents.json",
    "eslint.config.mjs",
    ".env",
    ".env.local",
  ];
  const folders =
    operation === "claudex"
      ? ["scripts", ".agents/_root-agents/settings"]
      : [
          "scripts",
          "app",
          "src",
          "e2e",
          "lib",
          "components",
          "hooks",
          "utils",
          "convex",
        ];
  const excluded = new Set([
    "node_modules",
    ".git",
    "zlocal",
    "dist",
    ".next",
    ".next-agent",
    ".next-e2e",
  ]);
  const visit = (relative) => {
    const file = path.join(root, relative);
    if (
      /^scripts\/(?:agents\/(?:cloud|host|sync|worktrees)|docs)\//.test(
        relative
      )
    )
      return;
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    // The local sandbox repair keeps generated toolchains in ignored .runtime*
    // directories. Its maintained build and launcher sources remain inputs.
    if (
      stat.isDirectory() &&
      path.dirname(relative) ===
        path.join("lib", "codex", "computer-use-sandbox") &&
      path.basename(relative).startsWith(".runtime")
    )
      return;
    if (stat.isSymbolicLink())
      throw new Error("Verification inputs must not be symlinks: " + relative);
    if (stat.isDirectory())
      for (const name of fs.readdirSync(file).sort()) {
        if (!excluded.has(name)) visit(path.join(relative, name));
      }
    else if (/\.(?:[cm]?[jt]sx?|json|ya?ml|css|mdc|sh)$/.test(relative))
      files.push(relative);
  };
  for (const folder of folders) visit(folder);
  return hash(
    [...new Set(files)]
      .sort()
      .filter((file) => fs.existsSync(path.join(root, file)))
      .map(
        (file) =>
          `${file}\0${hash(file === ".agents/environment.json" ? browserInputs(readEnvironment(root)) : fs.readFileSync(path.join(root, file)))}`
      )
      .join("\n")
  );
}

export function classifyFailure(stage, error, cleanup = "dead") {
  const message = String(error?.message ?? error ?? "");
  let kind = "test-failure",
    eligible = false;
  if (/interrupted/i.test(message)) kind = "interrupted";
  else if (
    /executable doesn't exist|cannot find module|ENOENT|missing.*browser|prerequisite/i.test(
      message
    )
  )
    kind = "dependency";
  else if (
    [
      "chromium-launch",
      "localhost",
      "server-start",
      "convex-start",
      "convex-keygen",
    ].includes(stage) &&
    /EPERM|EACCES|operation not permitted|permission denied/i.test(message)
  ) {
    kind = "permission";
    eligible = true;
  } else if (
    stage === "chromium-launch" &&
    /timeout|timed out|deadline/i.test(message)
  ) {
    kind = "launch-timeout";
    eligible = true;
  } else if (
    stage === "chromium-launch" &&
    /SIGTRAP|SIGABRT|SIGSEGV/i.test(message)
  ) {
    kind = "launch-crash";
    eligible = true;
  } else if (/panic|SIGABRT|SIGSEGV|dynamic.?store/i.test(message))
    kind = "native-panic";
  else if (/identity|ownership/i.test(message)) kind = "identity-mismatch";
  else if (stage === "cleanup") kind = "cleanup-failure";
  return {
    kind,
    retryEligible: eligible && cleanup === "dead",
    eligibleAfterCleanup: eligible,
  };
}
export function plan(root, operation, args = []) {
  root = fs.realpathSync(root);
  const command = operationCommand(root, operation, args);
  assertOperationPrerequisites(root, operation, args);
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  if (fs.existsSync(path.join(root, ".agents/browser-environments.json")))
    throw new Error(
      "Legacy browser evidence needs explicit migration: scripts:migrate --consolidate."
    );
  const prerequisites = inspectPrerequisites(root, operation);
  const environment = prerequisites.missing.length
    ? null
    : environmentIdentity(root, readEnvironment(root), operation);
  const route = environment
    ? initialRoute(environment, readEnvironment(root).browserVerification)
    : "preparation";
  return {
    root,
    operation,
    args,
    command,
    prerequisites: prerequisites.missing,
    environment,
    route,
    reason:
      route === "reviewed"
        ? "Unknown or stale effective restriction profile; required components lack matching sandbox success."
        : route === "preparation"
          ? "Missing project prerequisites must be prepared before any owned server."
          : "Matching component compatibility and effective context.",
    source: sourceFingerprint(root, operation),
  };
}
export function assertWorkflowCleanup(root) {
  const lock = safePath(root, "zlocal/agent-browser/active.lock");
  if (fs.existsSync(lock))
    throw new Error("An active or interrupted workflow lock needs recovery.");
}
function pending(request, action) {
  request.status = "review-required";
  request.pendingAction = action;
  request.retryCommand = [
    "pnpm",
    "agents:browser",
    action === "preparation" ? "prepare-reviewed" : "reviewed",
    request.id,
  ];
  request.nextRoute = action === "execution" ? "reviewed" : null;
  return request;
}
async function prepareRequest(root, request, reviewed = false, options = {}) {
  if (request.source !== sourceFingerprint(root, request.operation))
    throw new Error(
      "Verification inputs or environment changed; start a new workflow."
    );
  const prepLock =
    request.prerequisites.length &&
    (reviewed ||
      !inspectPrerequisites(root, request.operation).context.restricted)
      ? acquireLock(root, "active", request.id)
      : null;
  request.status = "preparing";
  saveRequest(root, request);
  try {
    const prepared = await prepareBrowser(root, request.operation, {
      reviewed,
      id: request.id,
      ...options,
      onReceipt: (receipts) => {
        request.preparation = receipts;
        request.activePreparation = receipts.at(-1);
        saveRequest(root, request);
      },
    });
    if (!prepared.ready) {
      pending(request, "preparation");
      saveRequest(root, request);
      return request;
    }
    Object.assign(request, plan(root, request.operation, request.args));
    request.preparation = prepared.receipts;
    request.activePreparation = null;
    request.status = "ready";
    request.pendingAction = null;
    request.retryCommand = null;
    request.nextRoute = request.route;
    if (request.route === "reviewed") pending(request, "execution");
    saveRequest(root, request);
    return request;
  } catch (error) {
    request.status = "blocked";
    request.failure = { component: "preparation", message: error.message };
    saveRequest(root, request);
    throw error;
  } finally {
    if (
      prepLock &&
      (!request.activePreparation ||
        request.activePreparation.cleanup === "dead")
    )
      releaseLock(prepLock);
  }
}
export async function executeRequest(root, request, execute = runOwned) {
  await reconcileBeforeRun(root);
  const current = plan(root, request.operation, request.args);
  const environmentMatches =
    request.nextRoute === "reviewed"
      ? current.environment?.runtimeFingerprint ===
        request.environment?.runtimeFingerprint
      : current.environment?.fingerprint === request.environment?.fingerprint;
  if (
    current.source !== request.source ||
    !environmentMatches ||
    JSON.stringify(current.command) !== JSON.stringify(request.command)
  )
    throw new Error(
      "Verification inputs or environment changed; start a new workflow."
    );
  if (
    !["ready", "review-required"].includes(request.status) ||
    request.reviewConsumed ||
    request.attempts.length >= 2
  )
    throw new Error("This workflow cannot run another attempt.");
  const route = request.nextRoute;
  if (!["sandbox", "reviewed", "host"].includes(route))
    throw new Error("Invalid execution route.");
  if (route !== "reviewed" && route !== current.route)
    throw new Error("Effective routing changed; start a new workflow.");
  // The reviewed CLI never elevates itself: the caller must submit this exact saved request through its host permission mechanism.
  for (const relative of [
    "zlocal/.agent-start.lock",
    "zlocal/.agent-owner.json",
    request.operation === "e2e" ? ".next-e2e/dev/lock" : ".next-agent/dev/lock",
  ])
    if (fs.existsSync(safePath(root, relative)))
      throw new Error("Unresolved server control blocks startup: " + relative);
  const lock = acquireLock(root, "active", request.id);
  const folder = safePath(
    root,
    `zlocal/artifacts/browser-workflow/${request.id}/placeholder`,
    true
  );
  const stageFile = path.join(
    path.dirname(folder),
    `attempt-${request.attempts.length + 1}.json`
  );
  atomicJSON(stageFile, { version: 2, stage: "runtime" });
  const temporary = safePath(
    root,
    `zlocal/artifacts/browser-workflow/${request.id}/tmp/placeholder`,
    true
  );
  const token = randomUUID();
  const attempt = {
    route,
    cleanup: "uncertain",
    environment: current.environment,
    token,
    supervisor: lock.supervisor,
    resources: [],
    controls: [],
    processFile: stageFile.replace(/\.json$/, ".processes.jsonl"),
    eventFile: stageFile.replace(/\.json$/, ".events.jsonl"),
    started: Date.now(),
  };
  request.attempts.push(attempt);
  request.status = "running";
  request.pendingAction = null;
  request.retryCommand = null;
  if (route === "reviewed") request.reviewConsumed = true;
  // Persist consumption and spawn intent before starting a child, including an interrupted reviewed launch.
  attempt.spawnIntent = true;
  saveRequest(root, request);
  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: "0",
    npm_config_frozen_lockfile: "true",
    AGENT_BROWSER_ROUTE: route,
    AGENT_BROWSER_ROOT: root,
    AGENT_BROWSER_TOKEN: token,
    AGENT_BROWSER_RUN_ID: request.id,
    AGENT_BROWSER_ATTEMPT: String(request.attempts.length),
    AGENT_BROWSER_STAGE_FILE: stageFile,
    TMPDIR: path.dirname(temporary),
    TMP: path.dirname(temporary),
    TEMP: path.dirname(temporary),
  };
  env.NODE_OPTIONS = `--import ${JSON.stringify(path.join(root, "scripts/verification/browser-spawn-tracker.mjs"))}`;
  delete env.NODE_PATH;
  for (const key of [
    "AGENT_BROWSER_OPTIONAL_PHASE",
    "AGENT_BROWSER_EVENT_PROCESS",
    "AGENT_BROWSER_CLEANUP_DEADLINE",
    "E2E_BACKEND_CACHE_DIR",
    "E2E_BACKEND_RELEASE_TAG",
    "E2E_INSTANCE_NAME",
    "E2E_BACKEND_URL",
    "E2E_SITE_PROXY_URL",
    "E2E_BACKEND_ADMIN_KEY",
    "AGENT_CONVEX_MODE",
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CONVEX_SITE_URL",
  ])
    delete env[key];
  try {
    const result = await execute(current.command, {
      cwd: root,
      env,
      onOutput: (text) => process.stdout.write(text),
      onSpawn: (pgid, identity) => {
        attempt.pgid = pgid;
        attempt.spawnIntent = false;
        if (identity) attempt.resources = [identity];
        saveRequest(root, request);
      },
      onResources: (resources) => {
        attempt.resources = resources;
        if (resources.some((item) => item.role === "next"))
          for (const relative of [
            "zlocal/.agent-start.lock",
            "zlocal/.agent-owner.json",
            request.operation === "e2e"
              ? ".next-e2e/dev/lock"
              : ".next-agent/dev/lock",
          ]) {
            if (!attempt.controls.some((item) => item.path === relative)) {
              const receipt = controlReceipt(root, relative);
              if (receipt && receipt.birth >= attempt.started - 2000)
                attempt.controls.push(receipt);
            }
          }
        saveRequest(root, request);
      },
    });
    const events = readEvents(attempt.eventFile);
    const original =
      events.find(
        (event) =>
          event.error && event.fatal !== false && event.phase !== "cleanup"
      ) ?? events.find((event) => event.error && event.fatal !== false);
    const legacyStage = readJSON(stageFile);
    const stage =
      original?.phase ??
      result.diagnostic?.phase ??
      events
        .filter((event) => !["cleanup", "complete"].includes(event.phase))
        .at(-1)?.phase ??
      legacyStage.stage;
    const message =
      original?.error?.message ??
      legacyStage.error ??
      result.error ??
      result.output;
    const classification = result.ok
      ? { kind: "passed", retryEligible: false }
      : classifyFailure(stage, message, result.cleanup);
    Object.assign(attempt, result, classification, {
      stage,
      finished: Date.now(),
      failure: result.ok
        ? null
        : {
            ...classification,
            retryEligible: classification.eligibleAfterCleanup,
            component: original?.component ?? result.diagnostic?.component,
            phase: stage,
            message,
            code: original?.error?.code,
            exit: result.code,
            signal: result.signal,
            log: stageFile,
          },
    });
    request.failure = attempt.failure;
    request.status =
      result.cleanup !== "dead"
        ? "cleanup-pending"
        : result.ok
          ? "passed"
          : classification.kind === "interrupted"
            ? "interrupted"
            : "failed";
    request.nextRoute = null;
    if (
      !result.ok &&
      result.cleanup === "dead" &&
      route === "sandbox" &&
      classification.retryEligible &&
      !request.reviewConsumed
    )
      pending(request, "execution");
    if (result.ok && execute === runOwned)
      request.compatibility = saveCompatibility(
        current.environment,
        route,
        requiredComponents(root, request.operation)
      );
    request.checks = ["browser"];
    const staticFile = safePath(
      root,
      "zlocal/agent-browser/claudex-static.json"
    );
    if (request.operation === "claudex" && fs.existsSync(staticFile)) {
      const receipt = readJSON(staticFile);
      if (
        receipt.passed &&
        receipt.source === request.source &&
        receipt.runtime === request.environment.runtimeFingerprint
      )
        request.checks.unshift("static");
    }
    saveRequest(root, request);
    if (result.cleanup === "dead") {
      releaseControls(root, attempt);
      releaseLock(lock);
    }
    return request;
  } catch (error) {
    attempt.failure ??= {
      kind: "interrupted",
      message: error.message,
      retryEligible: false,
    };
    request.failure = attempt.failure;
    request.status = "cleanup-pending";
    saveRequest(root, request);
    throw error;
  }
}
export function recordStaticChecks(root) {
  const environment = environmentIdentity(
    root,
    readEnvironment(root),
    "claudex"
  );
  atomicJSON(safePath(root, "zlocal/agent-browser/claudex-static.json", true), {
    passed: true,
    source: sourceFingerprint(root, "claudex"),
    runtime: environment.runtimeFingerprint,
  });
}
export async function startWorkflow(root, operation, args = [], execute) {
  root = fs.realpathSync(root);
  await reconcileBeforeRun(root);
  const request = {
    version: 2,
    id: randomUUID(),
    ...plan(root, operation, args),
    attempts: [],
    status: "preparing",
    reviewConsumed: false,
    preparation: [],
  };
  saveRequest(root, request);
  await prepareRequest(root, request);
  return request.status === "review-required"
    ? request
    : executeRequest(root, request, execute);
}
export async function reviewWorkflow(root, id, execute) {
  const { request } = loadRequest(root, id);
  if (request.nextRoute !== "reviewed" || request.pendingAction !== "execution")
    throw new Error("No reviewed attempt was requested.");
  return executeRequest(root, request, execute);
}
export async function reviewPreparation(root, id) {
  await reconcileBeforeRun(root);
  const { request } = loadRequest(root, id);
  if (request.pendingAction !== "preparation")
    throw new Error("No reviewed preparation was requested.");
  await prepareRequest(root, request, true);
  if (request.status === "ready") {
    pending(request, "execution");
    saveRequest(root, request);
  }
  return request;
}
export function denyWorkflow(root, id) {
  const { request } = loadRequest(root, id);
  if (request.status !== "review-required")
    throw new Error("No pending review to deny.");
  request.status = "denied";
  request.nextRoute = null;
  request.retryCommand = null;
  request.pendingAction = null;
  saveRequest(root, request);
  return request;
}
export function workflowStatus(root, id) {
  const { request } = loadRequest(root, id);
  let validity;
  try {
    const current = plan(root, request.operation, request.args);
    validity = {
      current:
        current.source === request.source &&
        current.environment?.runtimeFingerprint ===
          request.environment?.runtimeFingerprint,
      route: current.route,
    };
  } catch (error) {
    validity = { current: false, reason: error.message };
  }
  return { ...request, validity };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fs.realpathSync(path.resolve(import.meta.dirname, "../.."));
  try {
    const [action, operation, ...args] = process.argv.slice(2);
    let result;
    if (action === "run") result = await startWorkflow(root, operation, args);
    else if (action === "plan") result = plan(root, operation, args);
    else if (action === "reviewed" && !args.length)
      result = await reviewWorkflow(root, operation);
    else if (action === "prepare-reviewed" && !args.length)
      result = await reviewPreparation(root, operation);
    else if (action === "denied" && !args.length)
      result = denyWorkflow(root, operation);
    else if (action === "status" && !args.length)
      result = workflowStatus(root, operation);
    else if (action === "recover" && !args.length) {
      result = await recoverRequest(root, operation);
      if (
        result.compatibility?.saved === false &&
        result.compatibility.receipt
      ) {
        result.compatibility.saved = mergeCompatibilityReceipt(
          result.compatibility.receipt
        );
        saveRequest(root, result);
      }
    } else if (
      action === "migrate" &&
      (!operation || ["--apply", "--rollback"].includes(operation))
    )
      result = migrateState(
        root,
        operation === "--apply",
        operation === "--rollback"
      );
    else
      throw new Error(
        "Use run|plan OPERATION [bounded args], reviewed|prepare-reviewed|denied|status|recover UUID, or migrate [--apply]."
      );
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.retryCommand) {
      process.stderr.write(
        "Submit this exact saved command through host permission review: " +
          JSON.stringify(result.retryCommand) +
          "\n"
      );
      process.exitCode = RETRY_REQUIRED;
    } else if (
      [
        "failed",
        "denied",
        "running",
        "blocked",
        "cleanup-pending",
        "interrupted",
      ].includes(result.status)
    )
      process.exitCode = 1;
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
