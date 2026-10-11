import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  readEnvironment,
  satisfies,
} from "../agents/runtime/agent-runtime.mjs";
import {
  effectiveContext,
  environmentIdentity,
  fileDigest,
} from "./browser-compatibility.mjs";
import { atomicJSON, safePath } from "./browser-state.mjs";
import { declaredBackend } from "./convex-asset.mjs";
import { processIdentity, runOwned } from "./verification-process.mjs";

const claudexRuntime =
  ".agents/_root-agents/settings/vscursor-claudex-composer-runtime";

export function inspectPrerequisites(root, operation) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  const configuration = readEnvironment(root);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  const runtime = configuration.runtime;
  if (
    (runtime && process.version !== "v" + runtime.node) ||
    (pkg.engines?.node && !satisfies(process.version, pkg.engines.node))
  )
    throw new Error(
      "Required Node runtime is not selected; select the existing declared runtime. Browser preparation never installs a system runtime."
    );
  const require = createRequire(path.join(root, "package.json"));
  const missing = [];
  const lock = path.join(root, "pnpm-lock.yaml"),
    installedLock = path.join(root, "node_modules/.pnpm/lock.yaml");
  if (
    fs.existsSync(lock) &&
    (!fs.existsSync(installedLock) ||
      fileDigest(lock) !== fileDigest(installedLock))
  )
    missing.push("dependencies");
  for (const name of [
    "@playwright/test",
    ...(operation === "claudex" ? [] : ["next"]),
  ]) {
    try {
      require.resolve(name);
    } catch {
      if (!pkg.dependencies?.[name] && !pkg.devDependencies?.[name])
        throw new Error(
          `Missing browser prerequisite: declare ${name} before preparation. No owned server was started.`
        );
      missing.push("dependencies");
    }
  }
  if (operation === "claudex") {
    const runtimeRoot = path.join(root, claudexRuntime);
    const runtimeLock = path.join(runtimeRoot, "pnpm-lock.yaml");
    const runtimeInstalled = path.join(
      runtimeRoot,
      "node_modules/.pnpm/lock.yaml"
    );
    if (!fs.existsSync(runtimeLock))
      throw new Error(
        "Claudex composer runtime needs its checked-in frozen lockfile."
      );
    if (
      !fs.existsSync(runtimeInstalled) ||
      fileDigest(runtimeLock) !== fileDigest(runtimeInstalled)
    )
      missing.push("claudex-runtime");
  }
  if (!missing.length) {
    try {
      environmentIdentity(root, configuration, operation);
    } catch (error) {
      if (/Missing bundled Chromium/.test(error.message))
        missing.push("chromium");
      else if (/Missing declared Convex/.test(error.message))
        missing.push("convex");
      else throw error;
    }
  }
  if (
    operation !== "claudex" &&
    fs.existsSync(path.join(root, "convex")) &&
    !declaredBackend(root).valid
  )
    missing.push("convex");
  return {
    missing: [...new Set(missing)],
    configuration,
    context: effectiveContext(),
  };
}
export async function prepareBrowser(
  root,
  operation,
  {
    reviewed = false,
    execute = runOwned,
    env = process.env,
    onReceipt = () => {},
    id = randomUUID(),
  } = {}
) {
  const before = inspectPrerequisites(root, operation);
  if (!before.missing.length) return { ready: true, receipts: [] };
  if (!reviewed && before.context.restricted)
    return { ready: false, reviewRequired: true, missing: before.missing };
  const deadline = Date.now() + 600_000,
    receipts = [];
  const manager = spawnSync("pnpm", ["--version"], {
    cwd: root,
    env: { ...env, COREPACK_ENABLE_NETWORK: "0" },
    encoding: "utf8",
    timeout: 5000,
  });
  const spec =
    before.configuration.runtime?.packageManager ??
    JSON.parse(fs.readFileSync(path.join(root, "package.json"))).packageManager;
  if (
    manager.status !== 0 ||
    (spec && manager.stdout.trim() !== spec.slice(5).split("+")[0])
  )
    throw new Error(
      "Required existing pnpm runtime is unavailable; preparation does not install a replacement."
    );
  const run = async (component, command) => {
    if (Date.now() + 20_000 >= deadline)
      throw new Error("Preparation total deadline exceeded.");
    const receipt = {
      component,
      command,
      status: "running",
      started: Date.now(),
      route: "preparation",
      cleanup: "uncertain",
      supervisor: processIdentity(process.pid),
      token: randomUUID(),
      resources: [],
      spawnIntent: true,
    };
    const stageFile = safePath(
      root,
      `zlocal/artifacts/browser-workflow/${id}/preparation-${receipts.length + 1}.json`,
      true
    );
    atomicJSON(stageFile, { version: 2, stage: "preparation" });
    receipt.processFile = stageFile.replace(/\.json$/, ".processes.jsonl");
    receipts.push(receipt);
    onReceipt(receipts);
    const result = await execute(command, {
      cwd: root,
      env: {
        ...env,
        AGENT_BROWSER_TOKEN: receipt.token,
        AGENT_BROWSER_ROOT: root,
        AGENT_BROWSER_RUN_ID: id,
        AGENT_BROWSER_STAGE_FILE: stageFile,
        NODE_OPTIONS: `--import ${JSON.stringify(path.join(root, "scripts/verification/browser-spawn-tracker.mjs"))}`,
        NODE_PATH: "",
        PLAYWRIGHT_BROWSERS_PATH: "0",
        npm_config_frozen_lockfile: "true",
        COREPACK_ENABLE_NETWORK: "0",
      },
      timeout: deadline - Date.now() - 20_000,
      onSpawn: (_pid, identity) => {
        receipt.spawnIntent = false;
        if (identity) receipt.resources = [identity];
        onReceipt(receipts);
      },
      onResources: (resources) => {
        receipt.resources = resources;
        onReceipt(receipts);
      },
      onOutput: (value) => process.stdout.write(value),
    });
    Object.assign(receipt, {
      status: result.ok ? "passed" : "failed",
      cleanup: result.cleanup,
      finished: Date.now(),
      error: result.error,
    });
    onReceipt(receipts);
    if (!result.ok)
      throw new Error(
        `Preparation ${component} failed: ${result.error ?? result.output}; cleanup=${result.cleanup}`
      );
  };
  if (before.missing.includes("dependencies"))
    await run("dependencies", ["pnpm", "install", "--frozen-lockfile"]);
  if (before.missing.includes("claudex-runtime"))
    await run("claudex-runtime", [
      "pnpm",
      "--dir",
      claudexRuntime,
      "install",
      "--frozen-lockfile",
    ]);
  const remaining = inspectPrerequisites(root, operation).missing;
  if (remaining.includes("chromium"))
    await run("chromium", [
      "pnpm",
      "exec",
      "playwright",
      "install",
      "chromium",
    ]);
  if (remaining.includes("convex")) {
    if (
      !fs.existsSync(
        path.join(root, "scripts/verification/e2e-convex-backend.sh")
      )
    )
      throw new Error(
        "Project-supplied isolated Convex backend helper is missing."
      );
    await run("convex", [
      process.execPath,
      "scripts/verification/convex-asset.mjs",
    ]);
  }
  environmentIdentity(root, readEnvironment(root), operation);
  return { ready: true, receipts };
}
