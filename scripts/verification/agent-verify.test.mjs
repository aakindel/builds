import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { verificationCommand, verify } from "./agent-verify.mjs";

test("bounded verification rejects config, URL, environment and output escapes", (t) => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "agent-verify-"))
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "e2e"));
  fs.writeFileSync(path.join(root, "e2e/example.spec.ts"), "test");
  assert.ok(
    verificationCommand(root, "agent", ["e2e/example.spec.ts"]).includes(
      "--config=playwright.agent.config.ts"
    )
  );
  for (const arg of [
    "--config=evil.ts",
    "NODE_OPTIONS=evil",
    "../evil.spec.ts",
  ])
    assert.throws(() => verificationCommand(root, "agent", [arg]));
  assert.throws(() =>
    verificationCommand(root, "browser", ["--url=http://example.com"])
  );
  for (const route of ["//evil.com/", "http://evil.com/", "/\\evil.com/"])
    assert.throws(() =>
      verificationCommand(root, "screenshot", [
        route,
        "zlocal/artifacts/screenshots/a.webp",
      ])
    );
  assert.throws(() =>
    verificationCommand(root, "screenshot", ["/", ".codex/config.toml"])
  );
  assert.ok(
    verificationCommand(root, "screenshot", [
      "/pages",
      "zlocal/artifacts/screenshots/a.webp",
    ])
  );
});
test("failed startup reaps its child and removes signal handlers; retained live cleanup stops a retry", async (t) => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "verify-cleanup-"))
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  for (const folder of [
    "agents/cloud",
    "agents/host",
    "agents/runtime",
    "agents/sync",
    "agents/worktrees",
    "agents/shared",
    "dev",
    "verification",
    "docs",
    "editors/vscursor-claudex",
    "checks",
  ])
    fs.mkdirSync(path.join(root, "scripts", folder), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts/dev/agent-dev.sh"),
    "#!/bin/sh\nexit 7\n"
  );
  const handlers = [
    process.listenerCount("SIGINT"),
    process.listenerCount("SIGTERM"),
  ];
  await assert.rejects(verify(root, "browser"), /exited during startup/);
  assert.deepEqual(
    [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")],
    handlers
  );
  const pending = path.join(
    root,
    "zlocal/artifacts/agent-verify/cleanup-pending.json"
  );
  fs.mkdirSync(path.dirname(pending), { recursive: true });
  fs.writeFileSync(pending, JSON.stringify({ root, pids: [process.pid] }));
  await assert.rejects(verify(root, "browser"), /inspected cleanup/);
  assert.equal(fs.existsSync(pending), true);
});
