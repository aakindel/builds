import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { effectiveContext } from "./browser-compatibility.mjs";
import { inspectPrerequisites, prepareBrowser } from "./browser-prepare.mjs";
import {
  browserStage,
  describeFailure,
  recordBrowserProcess,
} from "./browser-session.mjs";
import {
  acquireLock,
  inspectRecovery,
  loadRequest,
  migrateState,
  reconcileBeforeRun,
  recoverRequest,
  releaseLock,
  safePath,
  saveRequest,
} from "./browser-state.mjs";
import {
  assertOperationPrerequisites,
  classifyFailure,
  denyWorkflow,
  environmentIdentity,
  initialRoute,
  operationCommand,
  plan,
  reviewWorkflow,
  sourceFingerprint,
  startWorkflow,
} from "./browser-workflow.mjs";
import { backendPlatform, declaredBackend } from "./convex-asset.mjs";
import {
  cleanupResources,
  completeIntent,
  identityState,
  processIdentity,
  readEvents,
  runOwned,
} from "./verification-process.mjs";

function fixture(t) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "browser-workflow-"))
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of [
    "scripts/dev/agent-dev.sh",
    "app/api/verification-health/route.ts",
    "scripts/verification/agent-verify.mjs",
    "scripts/verification/browser-preflight.mjs",
    "scripts/verification/browser-spawn-tracker.mjs",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "// fixture\n");
  }
  fs.mkdirSync(path.join(root, "node_modules/@playwright/test"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, "node_modules/next"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}\n");
  for (const name of ["@playwright/test", "next"])
    fs.writeFileSync(
      path.join(root, "node_modules", name, "package.json"),
      JSON.stringify({ version: "test", main: "index.cjs" })
    );
  fs.writeFileSync(
    path.join(root, "node_modules/next/index.cjs"),
    "module.exports={};"
  );
  fs.writeFileSync(
    path.join(root, "node_modules/@playwright/test/index.cjs"),
    `module.exports={chromium:{executablePath:()=>${JSON.stringify(process.execPath)}}};`
  );
  return root;
}
function execution(stage, error, ok = false, cleanup = "dead") {
  return async (_command, options) => {
    fs.writeFileSync(
      options.env.AGENT_BROWSER_STAGE_FILE,
      JSON.stringify({ stage, error })
    );
    assert.equal(options.env.PLAYWRIGHT_BROWSERS_PATH, "0");
    assert.match(options.env.NODE_OPTIONS, /browser-spawn-tracker/);
    return { ok, cleanup, output: error ?? "", code: ok ? 0 : 1 };
  };
}
function interrupted(root, overrides = {}) {
  const request = {
    version: 2,
    id: randomUUID(),
    root,
    operation: "browser",
    args: [],
    status: "cleanup-pending",
    reviewConsumed: false,
    attempts: [
      {
        route: "sandbox",
        cleanup: "uncertain",
        supervisor: { ...processIdentity(process.pid), boot: "previous-boot" },
        resources: [{ ...processIdentity(process.pid), boot: "previous-boot" }],
        failure: { kind: "permission", retryEligible: true, message: "EPERM" },
        ...overrides,
      },
    ],
  };
  saveRequest(root, request);
  return request;
}
test("fixed catalog rejects executable, config, URL, environment and output escapes", (t) => {
  const root = fixture(t);
  for (const operation of ["node", "bash", "git", "claudex"])
    assert.throws(() => operationCommand(root, operation));
  for (const args of [
    ["--config=evil"],
    ["../evil.spec.ts"],
    ["NODE_OPTIONS=evil"],
  ])
    assert.throws(() => operationCommand(root, "agent", args));
  for (const route of ["//evil.com", "https://evil.com", "/\\evil"])
    assert.throws(() =>
      operationCommand(root, "screenshot", [
        route,
        "zlocal/artifacts/screenshots/a.webp",
      ])
    );
  assert.throws(() => assertOperationPrerequisites(root, "agent"), /explicit/);
});
test("unknown profiles request review before any child and review is consumed once", async (t) => {
  const root = fixture(t),
    request = await startWorkflow(root, "browser", [], () =>
      assert.fail("No ordinary native startup")
    );
  assert.equal(request.status, "review-required");
  assert.equal(request.attempts.length, 0);
  const result = await reviewWorkflow(
    root,
    request.id,
    execution("complete", undefined, true)
  );
  assert.equal(result.status, "passed");
  assert.equal(result.reviewConsumed, true);
  await assert.rejects(reviewWorkflow(root, request.id), /No reviewed attempt/);
});
test("denial is persisted and cannot replay", async (t) => {
  const root = fixture(t),
    request = await startWorkflow(root, "browser");
  assert.equal(denyWorkflow(root, request.id).status, "denied");
  await assert.rejects(reviewWorkflow(root, request.id));
});
test("failure cause remains separate from cleanup and native panics are not permission proof", () => {
  assert.equal(
    classifyFailure("convex-start", "dynamic-store null object panic").kind,
    "native-panic"
  );
  for (const code of ["EPERM", "EACCES"]) {
    const failure = classifyFailure("server-start", code, "uncertain");
    assert.equal(failure.kind, "permission");
    assert.equal(failure.retryEligible, false);
    assert.equal(failure.eligibleAfterCleanup, true);
  }
  for (const [stage, message] of [
    ["fixtures", "AssertionError"],
    ["fixtures", "EPERM"],
    ["chromium-launch", "Executable doesn't exist"],
    ["chromium-launch", "interrupted"],
  ])
    assert.equal(classifyFailure(stage, message).retryEligible, false);
});
test("all required components need matching sandbox evidence and reviewed success cannot supply it", () => {
  const identity = {
    fingerprint: "context",
    facts: { context: { known: true, restricted: true } },
    keys: { chromium: "chrome", next: "next", convex: "convex" },
  };
  const store = {
    version: 2,
    components: {
      chrome: { sandboxPassed: true },
      next: { sandboxPassed: true },
      convex: { hostPassed: true },
    },
  };
  assert.equal(initialRoute(identity, {}, store), "reviewed");
  store.components.convex.sandboxPassed = true;
  assert.equal(initialRoute(identity, {}, store), "sandbox");
  identity.facts.context.known = false;
  assert.equal(initialRoute(identity, {}, store), "reviewed");
});
test("plan and status are read-only and source changes reject a reviewed continuation", async (t) => {
  const root = fixture(t);
  plan(root, "browser");
  assert.equal(fs.existsSync(path.join(root, "zlocal")), false);
  const request = await startWorkflow(root, "browser");
  const before = fs.statSync(
    path.join(root, "zlocal/agent-browser/requests", request.id + ".json")
  ).mtimeMs;
  loadRequest(root, request.id);
  assert.equal(
    fs.statSync(
      path.join(root, "zlocal/agent-browser/requests", request.id + ".json")
    ).mtimeMs,
    before
  );
  fs.writeFileSync(path.join(root, "package.json"), '{"changed":true}');
  await assert.rejects(
    reviewWorkflow(root, request.id, () => assert.fail("Changed input")),
    /inputs or environment changed/
  );
});
test("cloud, host and skills-sync settings do not invalidate local source or compatibility", (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, ".agents"));
  const file = path.join(root, ".agents/environment.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      cloud: { arbitrary: 1 },
      skillsSync: { enabled: false },
    })
  );
  const source = sourceFingerprint(root, "browser"),
    identity = environmentIdentity(root);
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      cloud: { arbitrary: 2 },
      hostRunner: { unrelated: true },
      skillsSync: { enabled: true },
    })
  );
  assert.equal(sourceFingerprint(root, "browser"), source);
  assert.equal(environmentIdentity(root).fingerprint, identity.fingerprint);
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "unrelated-lock-change");
  assert.notEqual(sourceFingerprint(root, "browser"), source);
  assert.equal(environmentIdentity(root).fingerprint, identity.fingerprint);
  fs.mkdirSync(path.join(root, "convex"));
  fs.writeFileSync(
    path.join(root, "convex/test.ts"),
    "export const changed=1;"
  );
  assert.notEqual(sourceFingerprint(root, "browser"), source);
});
test("generated sandbox caches are excluded but maintained scripts and symlinks remain inputs", (t) => {
  const root = fixture(t),
    folder = path.join(root, "lib/codex/computer-use-sandbox");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "build.sh"), "original");
  const source = sourceFingerprint(root, "browser");
  fs.mkdirSync(path.join(folder, ".runtime"));
  fs.symlinkSync(process.execPath, path.join(folder, ".runtime/tool"));
  assert.equal(sourceFingerprint(root, "browser"), source);
  fs.writeFileSync(path.join(folder, "build.sh"), "changed");
  assert.notEqual(sourceFingerprint(root, "browser"), source);
  fs.symlinkSync(process.execPath, path.join(folder, ".runtime-link"));
  assert.throws(() => sourceFingerprint(root, "browser"), /symlinks/);
});
test("missing undeclared prerequisites stop before server and do not install runtimes", async (t) => {
  const root = fixture(t);
  fs.rmSync(path.join(root, "node_modules"), { recursive: true });
  await assert.rejects(
    startWorkflow(root, "browser", [], () => assert.fail("No server")),
    /Missing browser prerequisite/
  );
  assert.equal(
    fs.existsSync(path.join(root, "zlocal/.agent-owner.json")),
    false
  );
});
test("live supervisors block recovery; dead records reconcile eligible failure without executing", async (t) => {
  const root = fixture(t),
    request = interrupted(root, { supervisor: processIdentity(process.pid) });
  assert.equal(inspectRecovery(root, request).state, "active");
  await assert.rejects(reconcileBeforeRun(root), /blocks startup/);
  request.attempts[0].supervisor.boot = "previous-boot";
  saveRequest(root, request);
  const recovered = await recoverRequest(root, request.id);
  assert.equal(recovered.status, "review-required");
  assert.equal(recovered.attempts[0].cleanup, "dead");
  assert.equal(recovered.attempts[0].failure.message, "EPERM");
});
test("consumed review, unknown identity, spawn gap and malformed records never authorize another launch", async (t) => {
  const root = fixture(t),
    request = interrupted(root);
  request.reviewConsumed = true;
  saveRequest(root, request);
  assert.equal((await recoverRequest(root, request.id)).status, "interrupted");
  for (const overrides of [
    { resources: [{ pid: process.pid }] },
    { spawnIntent: true },
  ]) {
    const unknown = interrupted(root, overrides);
    assert.equal(
      (await recoverRequest(root, unknown.id)).recovery.state,
      "blocked"
    );
  }
  const file = path.join(
    root,
    "zlocal/agent-browser/requests",
    request.id + ".json"
  );
  fs.writeFileSync(file, "broken");
  assert.throws(() => loadRequest(root, request.id));
});
test("exclusive locks are token checked and concurrent recovery cannot enter", (t) => {
  const root = fixture(t),
    lock = acquireLock(root, "recovery", "one");
  assert.throws(() => acquireLock(root, "recovery", "two"), /EEXIST/);
  assert.throws(
    () => releaseLock({ ...lock, token: "wrong" }),
    /ownership changed/
  );
  releaseLock(lock);
  fs.mkdirSync(path.join(root, "zlocal/agent-browser/requests"));
  fs.symlinkSync(
    "/private/tmp",
    path.join(root, "zlocal/agent-browser/unsafe")
  );
  assert.throws(
    () => safePath(root, "zlocal/agent-browser/unsafe/request.json", true),
    /Unsafe/
  );
});
test("migration preview is read-only, apply is idempotent and preserves historical originals", (t) => {
  const root = fixture(t),
    id = randomUUID(),
    folder = path.join(root, "zlocal/artifacts/browser-workflow", id);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, "request.json"),
    original = JSON.stringify({
      version: 1,
      root,
      id,
      status: "passed",
      attempts: [{ route: "reviewed", cleanup: "dead" }],
    });
  fs.writeFileSync(file, original);
  assert.equal(migrateState(root).changes.length, 1);
  assert.equal(fs.existsSync(path.join(root, "zlocal/agent-browser")), false);
  migrateState(root, true);
  assert.equal(migrateState(root, true).changes.length, 0);
  assert.equal(fs.readFileSync(file, "utf8"), original);
  assert.equal(loadRequest(root, id).request.reviewConsumed, true);
});
test("unmigrated legacy state blocks startup and migration never signals old numeric PIDs", async (t) => {
  const root = fixture(t),
    id = randomUUID();
  const folder = path.join(root, "zlocal/artifacts/browser-workflow", id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, "request.json"),
    JSON.stringify({
      version: 1,
      root,
      id,
      status: "cleanup-pending",
      attempts: [
        { route: "reviewed", cleanup: "uncertain", pgid: process.pid },
      ],
    })
  );
  await assert.rejects(reconcileBeforeRun(root), /explicit state migration/);
  migrateState(root, true);
  await assert.rejects(reconcileBeforeRun(root), /blocks startup/);
  assert.equal(loadRequest(root, id).request.status, "blocked");
});
test("portable backend asset mapping and cached receipt bind the declared release and executable", (t) => {
  assert.equal(backendPlatform("linux", "x64"), "x86_64-unknown-linux-gnu");
  assert.equal(backendPlatform("linux", "arm64"), "aarch64-unknown-linux-gnu");
  assert.equal(backendPlatform("darwin", "x64"), "x86_64-apple-darwin");
  assert.equal(backendPlatform("darwin", "arm64"), "aarch64-apple-darwin");
  assert.throws(() => backendPlatform("win32", "x64"), /Unsupported/);
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, "scripts/verification/e2e-convex-backend.sh"),
    'E2E_BACKEND_RELEASE_TAG="${E2E_BACKEND_RELEASE_TAG:-fixture-release}"\n'
  );
  const cache = path.join(root, "zlocal/.convex-local-backend");
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, "convex-local-backend"), "fixture", {
    mode: 0o755,
  });
  fs.writeFileSync(path.join(cache, "release-tag"), "fixture-release\n");
  assert.equal(declaredBackend(root).valid, true);
  fs.writeFileSync(
    path.join(cache, "asset.json"),
    JSON.stringify({
      release: "other",
      platform: backendPlatform(),
      binaryDigest: "0".repeat(64),
    })
  );
  assert.equal(declaredBackend(root).valid, false);
});
test("provider names alone never establish a complete restriction profile", () => {
  for (const env of [
    { CODEX_THREAD_ID: "fixture", CODEX_SANDBOX: "seatbelt" },
    { CLAUDE_CODE_ENTRYPOINT: "cli", CLAUDE_CODE_SANDBOX: "restricted" },
    { CURSOR_AGENT: "1" },
  ]) {
    assert.equal(effectiveContext(env).known, false);
    assert.equal(effectiveContext(env).restricted, true);
  }
  assert.equal(
    effectiveContext({
      AGENT_BROWSER_ENVIRONMENT: "profile-v1",
      CODEX_SANDBOX: "none",
    }).restricted,
    false
  );
});
test("preparation selects bundled Chromium before Playwright captures its registry", (t) => {
  const root = fixture(t),
    previous = process.env.PLAYWRIGHT_BROWSERS_PATH;
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  fs.writeFileSync(
    path.join(root, "node_modules/@playwright/test/index.cjs"),
    `const executable=process.env.PLAYWRIGHT_BROWSERS_PATH==='0'?${JSON.stringify(process.execPath)}:'/missing-global-browser';module.exports={chromium:{executablePath:()=>executable}};`
  );
  try {
    assert.deepEqual(inspectPrerequisites(root, "browser").missing, []);
    assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, "0");
  } finally {
    if (previous === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = previous;
  }
});
test("restricted frozen-dependency preparation requires its own review before any child", async (t) => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n"
  );
  const result = await prepareBrowser(root, "browser", {
    execute: () => assert.fail("spawn before preparation review"),
  });
  assert.equal(result.reviewRequired, true);
  assert.deepEqual(result.missing, ["dependencies"]);
});
test("Claudex preparation includes its frozen composer package and never launches fixtures on its preparation grant", async (t) => {
  const root = fixture(t),
    runtime = path.join(
      root,
      ".agents/_root-agents/settings/vscursor-claudex-composer-runtime"
    );
  fs.mkdirSync(runtime, { recursive: true });
  fs.writeFileSync(
    path.join(runtime, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n"
  );
  const result = await prepareBrowser(root, "claudex", {
    execute: () => assert.fail("fixtures cannot consume a preparation grant"),
  });
  assert.deepEqual(result.missing, ["claudex-runtime"]);
  assert.equal(result.reviewRequired, true);
});
test("live event reads tolerate only an incomplete final write; final and malformed records fail", (t) => {
  const file = path.join(fixture(t), "events.jsonl");
  fs.writeFileSync(file, '{"seq":1}\n{"seq":');
  assert.deepEqual(readEvents(file, { live: true }), [{ seq: 1 }]);
  assert.throws(() => readEvents(file));
  fs.writeFileSync(file, 'malformed\n{"seq":');
  assert.throws(() => readEvents(file, { live: true }));
});
test("a synchronous spawn receipt requires the child's actual anchored identity and birth window", () => {
  const intent = { type: "intent", intent: randomUUID() };
  const identity = {
    ...processIdentity(process.pid, "fixture"),
    anchor: { file: "fixture" },
  };
  const at = Date.parse(identity.start) + 500;
  const spawned = {
    type: "spawned",
    intent: intent.intent,
    pid: identity.pid,
    boot: identity.boot,
    token: "fixture",
    nodeExecutable: identity.executable,
    at,
  };
  assert.equal(completeIntent(intent, [spawned]), false);
  assert.equal(
    completeIntent(intent, [spawned, { type: "resource", identity }]),
    true
  );
  assert.equal(
    completeIntent(intent, [
      spawned,
      { type: "resource", identity: { ...identity, anchor: undefined } },
    ]),
    false
  );
  assert.equal(
    completeIntent(intent, [
      spawned,
      { type: "resource", identity: { ...identity, boot: "reused-boot" } },
    ]),
    false
  );
  assert.equal(
    completeIntent(intent, [
      { ...spawned, at: at + 10000 },
      { type: "resource", identity },
    ]),
    false
  );
});
test("event writers preserve per-process sequence and resource registration never resets stage clocks", (t) => {
  const root = fixture(t),
    id = randomUUID(),
    folder = path.join(root, "zlocal/artifacts/browser-workflow", id);
  fs.mkdirSync(folder, { recursive: true });
  const prior = { ...process.env };
  t.after(() => {
    for (const key of ["AGENT_BROWSER_ROOT", "AGENT_BROWSER_STAGE_FILE"]) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  });
  process.env.AGENT_BROWSER_ROOT = root;
  process.env.AGENT_BROWSER_STAGE_FILE = path.join(folder, "attempt-1.json");
  browserStage("chromium-launch");
  recordBrowserProcess({ type: "intent", intent: "one" });
  browserStage("fixtures");
  const events = fs
    .readFileSync(path.join(folder, "attempt-1.events.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(events.length, 2);
  assert.equal(events[0].phase, "chromium-launch");
  assert.equal(events[1].sequence, events[0].sequence + 1);
  assert.match(
    describeFailure(
      new Error("fetch failed", {
        cause: Object.assign(new Error("blocked"), { code: "EACCES" }),
      })
    ).message,
    /blocked/
  );
});
test("deadline cleanup reaps an owned disposable child and restores signal listeners", async () => {
  const handlers = [
    process.listenerCount("SIGINT"),
    process.listenerCount("SIGTERM"),
  ];
  const result = await runOwned(
    [process.execPath, "-e", "setInterval(()=>{},1000)"],
    { cwd: process.cwd(), env: process.env, timeout: 100, cleanup: 1000 }
  );
  assert.equal(result.cleanup, "dead");
  assert.match(result.error, /deadline/);
  assert.deepEqual(
    [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
    handlers
  );
});
test("PID reuse and reboot are distinguished; uncertain records are never signalled", async () => {
  const identity = processIdentity(process.pid);
  assert.equal(identityState(identity), "live");
  assert.equal(identityState({ ...identity, start: "other" }), "reused");
  assert.equal(identityState({ ...identity, boot: "other" }), "dead");
  const result = await cleanupResources([{ pid: process.pid }], {
    cleanup: 20,
  });
  assert.equal(result.cleanup, "uncertain");
});

test("changing a Node process title does not change its executable identity", () => {
  const original = process.title,
    identity = processIdentity(process.pid);
  try {
    process.title = "recovery-title-fixture";
    assert.equal(identityState(identity), "live");
  } finally {
    process.title = original;
  }
});
test("an abandoned disposable child is cleaned and its unused reviewed continuation remains executable", async (t) => {
  const { spawn } = await import("node:child_process");
  const root = fixture(t),
    token = randomUUID();
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    env: { ...process.env, AGENT_BROWSER_TOKEN: token },
    detached: true,
    stdio: "ignore",
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  t.after(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* The disposable direct child may already be reaped. */
    }
  });
  const identity = processIdentity(child.pid, token, "wrapper");
  assert.ok(identity);
  const request = interrupted(root, { resources: [identity], token });
  Object.assign(request, plan(root, "browser"));
  saveRequest(root, request);
  const recovered = await recoverRequest(root, request.id, { cleanup: 1000 });
  assert.equal(recovered.status, "review-required");
  assert.equal(identityState(identity), "dead");
  assert.equal(
    (
      await reviewWorkflow(
        root,
        request.id,
        execution("complete", undefined, true)
      )
    ).status,
    "passed"
  );
});
test("migration rollback preserves originals and refuses later record changes", (t) => {
  const root = fixture(t),
    id = randomUUID(),
    folder = path.join(root, "zlocal/artifacts/browser-workflow", id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, "request.json"),
    JSON.stringify({ version: 1, id, root, status: "passed", attempts: [] })
  );
  migrateState(root, true);
  migrateState(root, false, true);
  assert.equal(
    fs.existsSync(
      path.join(root, "zlocal/agent-browser/requests", id + ".json")
    ),
    false
  );
  migrateState(root, true);
  const { request } = loadRequest(root, id);
  request.changed = true;
  saveRequest(root, request);
  assert.throws(
    () => migrateState(root, false, true),
    /Changed migration destination preserved/
  );
});
test("the full chain scopes nested native commands to descendants and reaps a detached browser group", async (t) => {
  const root = fixture(t),
    id = randomUUID(),
    folder = path.join(root, "zlocal/artifacts/browser-workflow", id);
  fs.mkdirSync(path.join(folder, "tmp"), { recursive: true });
  const { scriptBundle } = await import("../agents/shared/script-layout.mjs");
  for (const file of [...scriptBundle("browser"), "scripts/dev/agent-dev.sh"]) {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.resolve(file), destination);
  }
  const executable = path.join(root, "node_modules/owned/chrome");
  fs.mkdirSync(path.dirname(executable));
  fs.writeFileSync(
    executable,
    `#!${process.execPath}\nsetInterval(()=>{},1000);\n`,
    { mode: 0o755 }
  );
  fs.writeFileSync(
    path.join(root, "scripts/verification/browser-preflight.mjs"),
    `import {spawn} from "node:child_process";import {runOwned} from "./verification-process.mjs";const nested=await runOwned(["/bin/echo","fixture-key"],{cwd:process.cwd(),env:process.env,shareCleanup:false,timeout:5000});if(!nested.ok||nested.cleanup!=="dead"||!nested.output.includes("fixture-key")||nested.resources.some(r=>r.pid===process.pid))throw new Error("Nested command crossed its descendant boundary: "+JSON.stringify(nested));const child=spawn(${JSON.stringify(executable)},["--user-data-dir="+process.env.TMPDIR+"/owned"],{detached:true,stdio:"ignore"});child.unref();setTimeout(()=>process.exit(0),100);`
  );
  fs.mkdirSync(path.join(root, "node_modules/.bin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "node_modules/.bin/next"),
    `#!${process.execPath}\nconst http=require("node:http"),fs=require("node:fs"),{spawn}=require("node:child_process");process.title="next-server (fixture)";const server=http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify({root:fs.realpathSync(process.cwd()),role:"agent",runId:process.env.VERIFICATION_RUN_ID}));});server.listen(Number(process.argv[process.argv.indexOf("-p")+1]),"127.0.0.1");process.on("SIGTERM",()=>{spawn(process.execPath,["-e","setTimeout(()=>{},30000)"],{detached:true,stdio:"ignore"}).unref();server.close(()=>process.exit(0));});`,
    { mode: 0o755 }
  );
  const stage = path.join(folder, "attempt-1.json");
  fs.writeFileSync(stage, '{"stage":"runtime"}');
  const result = await runOwned(
    [process.execPath, "scripts/verification/agent-verify.mjs", "browser"],
    {
      cwd: root,
      env: {
        ...process.env,
        AGENT_BROWSER_ROOT: root,
        AGENT_BROWSER_TOKEN: randomUUID(),
        AGENT_BROWSER_STAGE_FILE: stage,
        TMPDIR: path.join(folder, "tmp"),
        NODE_OPTIONS: `--import ${JSON.stringify(path.join(root, "scripts/verification/browser-spawn-tracker.mjs"))}`,
      },
      timeout: 10_000,
      cleanup: 2000,
    }
  );
  assert.equal(result.cleanup, "dead", result.output);
  assert.equal(
    result.ok,
    true,
    JSON.stringify({
      error: result.error,
      diagnostic: result.diagnostic,
      code: result.code,
      signal: result.signal,
      output: result.output,
    })
  );
  assert.ok(result.resources.some((item) => item.role === "chromium"));
  assert.ok(result.groups.length >= 3);
  assert.equal(
    fs.existsSync(path.join(root, "zlocal/.agent-owner.json")),
    false
  );
});
test("simulated uninterruptible children return within the cleanup bound and identity loss forbids signalling", async () => {
  const signals = [],
    start = Date.now();
  const result = await cleanupResources([{ pid: 111 }], {
    cleanup: 25,
    inspectRecord: () => "live",
    discoverProcesses: (items) => items,
    signalProcess: (pid, signal) => signals.push([pid, signal]),
  });
  assert.equal(result.cleanup, "live");
  assert.ok(Date.now() - start < 500);
  assert.ok(signals.some(([, signal]) => signal === "SIGTERM"));
  let inspected = 0;
  const forbidden = [];
  const uncertain = await cleanupResources([{ pid: 112 }], {
    cleanup: 25,
    inspectRecord: () => (++inspected === 1 ? "live" : "uncertain"),
    discoverProcesses: (items) => items,
    signalProcess: (...value) => forbidden.push(value),
  });
  assert.equal(uncertain.cleanup, "uncertain");
  assert.deepEqual(forbidden, []);
});
test("a completed optional-copy error remains evidence and cannot expire its old phase clock", async (t) => {
  const root = fixture(t),
    file = path.join(root, "optional.json");
  const result = await runOwned(
    [process.execPath, "-e", "setTimeout(()=>{},300)"],
    {
      cwd: root,
      env: { ...process.env, AGENT_BROWSER_STAGE_FILE: file },
      timeout: 2000,
      cleanup: 1000,
      onSpawn: (pid) =>
        fs.writeFileSync(
          file.replace(/\.json$/, ".events.jsonl"),
          JSON.stringify({
            pid,
            component: "convex",
            phase: "convex-export",
            at: Date.now() - 121000,
            fatal: false,
            error: { message: "Optional development-data copy unavailable" },
          }) + "\n"
        ),
    }
  );
  assert.equal(result.ok, true, result.error);
  assert.equal(result.cleanup, "dead");
  assert.equal(
    readEvents(file.replace(/\.json$/, ".events.jsonl"))[0].error.message,
    "Optional development-data copy unavailable"
  );
});
test("unavailable descendant inspection retains uncertainty even when known PIDs are dead", async () => {
  const signals = [];
  const result = await cleanupResources([{ pid: 114 }], {
    cleanup: 25,
    inspectRecord: () => "dead",
    discoverProcesses: () => {
      throw new Error("inspection unavailable");
    },
    signalProcess: (...args) => signals.push(args),
  });
  assert.equal(result.cleanup, "uncertain");
  assert.match(result.cleanupError, /inspection unavailable/);
  assert.deepEqual(signals, []);
});
test("a proven stale recovery lock is reconciled but a changed/live owner is retained", (t) => {
  const root = fixture(t),
    lock = acquireLock(root, "recovery", "old"),
    owner = JSON.parse(fs.readFileSync(lock.file));
  owner.supervisor.boot = "previous-boot";
  fs.writeFileSync(lock.file, JSON.stringify(owner));
  const next = acquireLock(root, "recovery", "next");
  assert.notEqual(next.token, lock.token);
  assert.throws(() => acquireLock(root, "recovery", "competing"), /EEXIST/);
  releaseLock(next);
});
