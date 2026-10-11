import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { GET } from "../../app/api/verification-health/route.ts";
import globalSetup, {
  readAgentBaseURL,
  runBrowserPreflight,
  validateVerificationURL,
} from "./browser-preflight.mjs";
import { readEvents } from "./verification-process.mjs";

function fixture(t) {
  const scratch = path.resolve("zlocal/artifacts/browser-preflight-unit");
  fs.mkdirSync(scratch, { recursive: true });
  const rootDir = fs.mkdtempSync(path.join(scratch, "case-"));
  fs.mkdirSync(path.join(rootDir, "zlocal"));
  const ownerFile = path.join(rootDir, "zlocal/.agent-owner.json");
  const owner = {
    root: fs.realpathSync(rootDir),
    port: 3100,
    wrapperPid: 123,
    childPid: 124,
    token: "a".repeat(64),
    runId: "fixture-run",
  };
  fs.writeFileSync(ownerFile, JSON.stringify(owner));
  t.after(() => fs.rmSync(rootDir, { recursive: true }));
  return { rootDir, ownerFile, owner, baseURL: "http://127.0.0.1:3100" };
}

function dependencies(options, overrides = {}) {
  const calls = { launches: 0, closes: 0, visits: 0 };
  let pageError;
  const page = {
    on: (_event, callback) => {
      pageError = callback;
    },
    off: () => {},
    setContent: async () => {},
    getByRole: () => ({
      click: async () => {},
      textContent: async () => "Passed",
    }),
    goto: async () => {
      calls.visits++;
      if (overrides.pageError) pageError(new Error("Hydration broke"));
      return { ok: () => true, status: () => 200 };
    },
    url: () => `${options.baseURL}/fixture`,
    locator: () => ({
      count: async () => (overrides.overlay ? 1 : 0),
      first: () => ({ innerText: async () => "Missing html/body" }),
    }),
    evaluate: async () => overrides.styled ?? true,
  };
  const browser = {
    version: () => "test-browser",
    newPage: async () => {
      if (overrides.newPageError) throw new Error("Context creation failed");
      return page;
    },
    close: async () => {
      calls.closes++;
    },
  };
  return {
    calls,
    chromium: {
      executablePath: () => "/hermetic/chromium",
      launch: async () => {
        calls.launches++;
        if (overrides.launchError) throw new Error("Launch exited SIGTRAP");
        return browser;
      },
    },
    fetch: async () => {
      if (overrides.networkError)
        throw new Error("fetch failed", { cause: new Error("connect EPERM") });
      return {
        ok: true,
        json: async () => ({
          role: overrides.role ?? "agent",
          root: overrides.root ?? fs.realpathSync(options.rootDir),
          runId: overrides.runId ?? options.owner.runId,
        }),
      };
    },
  };
}

test("only exact owned agent ports and dedicated E2E ports are accepted", (t) => {
  const options = fixture(t);
  const context = {
    E2E_ROOT: fs.realpathSync(options.rootDir),
    E2E_RUN_ID: "00000000-0000-4000-8000-000000000000",
    E2E_LAUNCHER_PID: String(process.pid),
    E2E_BASE_URL: "http://127.0.0.1:3130",
  };
  const previous = Object.fromEntries(
    Object.keys(context).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, context);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  assert.equal(readAgentBaseURL(options.rootDir), options.baseURL);
  for (const port of [
    "3100junk",
    "3100.5",
    "03100",
    "3000",
    "3111",
    "3120",
    "",
  ]) {
    fs.writeFileSync(
      options.ownerFile,
      JSON.stringify({ ...options.owner, port })
    );
    assert.throws(() => readAgentBaseURL(options.rootDir), /exact port/);
  }
  fs.writeFileSync(options.ownerFile, JSON.stringify(options.owner));
  for (const url of [
    "http://localhost:3100",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3101",
    "http://127.0.0.1:3100/foo",
    "http://127.0.0.1:3100?x=1",
    "http://user@127.0.0.1:3100",
    "http://127.0.0.1:03100",
    "https://127.0.0.1:3100",
  ]) {
    assert.throws(() => validateVerificationURL(url, "agent", options.rootDir));
  }
  assert.equal(
    validateVerificationURL(`${options.baseURL}/`, "agent", options.rootDir),
    options.baseURL
  );
  assert.equal(
    validateVerificationURL("http://127.0.0.1:3130", "e2e", options.rootDir),
    "http://127.0.0.1:3130"
  );
  assert.throws(() => validateVerificationURL("http://127.0.0.1:3100", "e2e"));
  assert.throws(
    () =>
      validateVerificationURL("http://127.0.0.1:3120", "e2e", options.rootDir),
    /launcher's endpoint/
  );
});

test("foreign project or non-agent listener is rejected before Chromium launches", async (t) => {
  const options = fixture(t);
  for (const override of [{ root: "/other/project" }, { role: "dev" }]) {
    const deps = dependencies(options, override);
    await assert.rejects(
      runBrowserPreflight(options, deps),
      /not this project's isolated/
    );
    assert.equal(deps.calls.launches, 0);
  }
});

test("sandbox localhost block preserves nested EPERM and does not launch or retry", async (t) => {
  const options = fixture(t);
  const deps = dependencies(options, { networkError: true });
  await assert.rejects(
    runBrowserPreflight(options, deps),
    /failed at localhost[\s\S]*connect EPERM/
  );
  assert.equal(deps.calls.launches, 0);
});

test("launch fails once with version/path diagnostics before visiting fixtures", async (t) => {
  const options = fixture(t);
  const deps = dependencies(options, { launchError: true });
  await assert.rejects(
    runBrowserPreflight(options, deps),
    /chromium-launch[\s\S]*Playwright[\s\S]*hermetic[\s\S]*SIGTRAP/
  );
  assert.equal(deps.calls.launches, 1);
  assert.equal(deps.calls.visits, 0);
});

test("browser closes even when page/context creation fails", async (t) => {
  const options = fixture(t);
  const deps = dependencies(options, { newPageError: true });
  await assert.rejects(
    runBrowserPreflight(options, deps),
    /Context creation failed/
  );
  assert.equal(deps.calls.closes, 1);
});

test("unstyled fixtures, error overlays, and runtime exceptions stop the suite", async (t) => {
  const options = { ...fixture(t), paths: ["/fixture"], requireStyles: true };
  for (const [override, message] of [
    [{ styled: false }, /Global styles/],
    [{ overlay: true }, /Missing html\/body/],
    [{ pageError: true }, /Hydration broke/],
  ]) {
    const deps = dependencies(options, override);
    await assert.rejects(runBrowserPreflight(options, deps), message);
    assert.equal(deps.calls.closes, 1);
  }
});

test("fixtures cannot send preflight to another origin", async (t) => {
  const options = { ...fixture(t), paths: ["//example.com/"] };
  const deps = dependencies(options);
  await assert.rejects(
    runBrowserPreflight(options, deps),
    /must stay on the isolated server/
  );
  assert.equal(deps.calls.visits, 0);
  assert.equal(deps.calls.closes, 1);
});

test("successful smoke writes diagnostics and closes Chromium", async (t) => {
  const options = { ...fixture(t), paths: ["/fixture"], requireStyles: true };
  const deps = dependencies(options);
  const report = await runBrowserPreflight(options, deps);
  assert.equal(report.ok, true);
  assert.equal(deps.calls.closes, 1);
  assert.equal(deps.calls.visits, 1);
  assert.equal(
    JSON.parse(
      fs.readFileSync(
        path.join(
          options.rootDir,
          "zlocal/artifacts/browser-preflight/agent.json"
        )
      )
    ).ok,
    true
  );
});

test("a successful preflight ends the next component's localhost phase", async (t) => {
  const stageFile = path.resolve(
    "zlocal/artifacts/browser-workflow",
    randomUUID(),
    "attempt-1.json"
  );
  fs.mkdirSync(path.dirname(stageFile), { recursive: true });
  t.after(() =>
    fs.rmSync(path.dirname(stageFile), { recursive: true, force: true })
  );
  const variables = {
    AGENT_BROWSER_STAGE_FILE: stageFile,
    AGENT_BROWSER_ROOT: process.cwd(),
  };
  const previous = Object.fromEntries(
    Object.keys(variables).map((name) => [name, process.env[name]])
  );
  Object.assign(process.env, variables);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const options = { ...fixture(t), paths: ["/fixture"] };
  const report = await runBrowserPreflight(options, dependencies(options));
  assert.equal(report.ok, true);
  // The supervisor applies phase deadlines to the latest event for each
  // process and component, so no next clock may be left at localhost.
  const latest = new Map();
  for (const event of readEvents(stageFile.replace(/\.json$/, ".events.jsonl")))
    latest.set(event.component, event.phase);
  assert.equal(latest.get("next"), "next-ready");
});

test("global setup requires an explicit isolated verification role", async () => {
  await assert.rejects(
    globalSetup({ metadata: {} }),
    /Missing browserVerification/
  );
});

test("health identity is unavailable to normal dev/production and identifies isolated modes", async (t) => {
  const agent = process.env.NEXT_AGENT;
  const e2e = process.env.NEXT_E2E;
  t.after(() => {
    if (agent === undefined) delete process.env.NEXT_AGENT;
    else process.env.NEXT_AGENT = agent;
    if (e2e === undefined) delete process.env.NEXT_E2E;
    else process.env.NEXT_E2E = e2e;
  });
  delete process.env.NEXT_AGENT;
  delete process.env.NEXT_E2E;
  assert.equal(GET().status, 404);
  for (const [variable, role] of [
    ["NEXT_E2E", "e2e"],
    ["NEXT_AGENT", "agent"],
  ]) {
    process.env[variable] = "1";
    const response = GET();
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      role,
      root: fs.realpathSync(process.cwd()),
    });
  }
});

test("installer browser helpers stay identical to the exercised project sources", (t) => {
  const common =
    ".agents/_root-agents/skills/agent-skills/agent-isolation/add-agent-isolation/references/common";
  if (!fs.existsSync(common))
    return t.skip("Installer source is only present in ui-library.");
  for (const file of [
    "scripts/dev/runtime-servers.mjs",
    "scripts/dev/runtime-servers.cjs",
    "scripts/dev/runtime-servers.d.cts",
    "scripts/dev/runtime-servers.d.mts",
    "scripts/verification/e2e-run.sh",
    "scripts/verification/browser-preflight.mjs",
    "scripts/verification/browser-preflight.d.mts",
    "scripts/verification/browser-preflight.test.mjs",
    "scripts/verification/browser-session.mjs",
    "scripts/verification/browser-session.d.mts",
    "scripts/verification/browser-spawn-tracker.mjs",
    "scripts/verification/browser-workflow.mjs",
    "scripts/verification/browser-workflow.test.mjs",
    "scripts/verification/verification-process.mjs",
    "scripts/verification/agent-verify.mjs",
    "app/api/verification-health/route.ts",
  ]) {
    assert.equal(
      fs.readFileSync(path.join(common, file), "utf8"),
      fs.readFileSync(file, "utf8"),
      `Installer drift: ${file}`
    );
  }
});

test("a replacement agent run is rejected before browser launch", async (t) => {
  const options = fixture(t);
  options.owner.runId = "original-run";
  fs.writeFileSync(options.ownerFile, JSON.stringify(options.owner));
  const deps = dependencies(options, { runId: "replacement-run" });
  await assert.rejects(
    runBrowserPreflight(options, deps),
    /not this project's isolated/
  );
  assert.equal(deps.calls.launches, 0);
});
