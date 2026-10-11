import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import {
  readEnvironment,
  stableJSON,
} from "../agents/runtime/agent-runtime.mjs";
import { requiredComponents } from "./browser-adapters.mjs";
import { atomicJSON, readJSON, safePath } from "./browser-state.mjs";

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function fileDigest(file) {
  const hash = createHash("sha256"),
    buffer = Buffer.alloc(64 * 1024),
    fd = fs.openSync(file, "r");
  try {
    let size;
    while ((size = fs.readSync(fd, buffer, 0, buffer.length, null)))
      hash.update(buffer.subarray(0, size));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}
export function browserInputs(configuration) {
  const settings = { ...configuration.browserVerification };
  delete settings.environments;
  return stableJSON({
    runtime: configuration.runtime,
    browserVerification: settings,
  });
}
export function effectiveContext(env = process.env) {
  const provider = env.CODEX_THREAD_ID
    ? "codex"
    : env.CLAUDE_CODE_ENTRYPOINT
      ? "claude"
      : env.CURSOR_AGENT
        ? "cursor"
        : "unknown";
  const restriction = env.CODEX_SANDBOX ?? env.CLAUDE_CODE_SANDBOX ?? "unknown";
  // A provider name and a generic sandbox label do not identify the full policy.
  return {
    provider,
    restriction,
    profile: env.AGENT_BROWSER_ENVIRONMENT ?? null,
    known: Boolean(env.AGENT_BROWSER_ENVIRONMENT),
    restricted: !["none", "danger-full-access"].includes(restriction),
  };
}
export function environmentIdentity(
  root,
  configuration = readEnvironment(root),
  operation = "browser"
) {
  // Playwright captures its registry path on first import in a process. Select
  // the bundled path before any prerequisite lookup, including reviewed prep.
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  const require = createRequire(path.join(root, "package.json"));
  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch (error) {
    throw new Error(
      "Missing browser prerequisite: @playwright/test. No owned server was started.",
      { cause: error }
    );
  }
  const executable = chromium.executablePath();
  if (!fs.existsSync(executable))
    throw new Error("Missing bundled Chromium. No owned server was started.");
  const browserFiles = [{ digest: fileDigest(executable) }];
  const cacheIndex = executable.indexOf("/.local-browsers/");
  if (cacheIndex >= 0) {
    const cache = executable.slice(0, cacheIndex + "/.local-browsers".length);
    const revision = path
      .relative(cache, executable)
      .split(path.sep)[0]
      .match(/^chromium-(\d+)$/)?.[1];
    const shell = path.join(cache, `chromium_headless_shell-${revision}`);
    if (!fs.existsSync(shell))
      throw new Error(
        "Missing bundled Chromium headless shell for the installed revision. No owned server was started."
      );
    const visit = (folder) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (
          entry.isFile() &&
          /^(?:chrome-headless-shell|headless_shell)(?:\.exe)?$/.test(
            entry.name
          )
        )
          browserFiles.push({ digest: fileDigest(file) });
      }
    };
    visit(shell);
    if (browserFiles.length === 1)
      throw new Error(
        "Missing bundled Chromium headless shell. No owned server was started."
      );
  }
  const context = effectiveContext();
  const runtime = {
    platform: process.platform,
    arch: process.arch,
    os: os.release(),
    node: process.version,
    nodeDigest: fileDigest(process.execPath),
    declarations: browserInputs(configuration),
    marker: context.profile,
  };
  const readVersion = (name) => {
    try {
      return require(name + "/package.json").version;
    } catch {
      return null;
    }
  };
  const launchInputs = (files) =>
    digest(
      files
        .map((file) =>
          fs.existsSync(path.join(root, file))
            ? fileDigest(path.join(root, file))
            : "missing"
        )
        .join("\n")
    );
  const components = {
    chromium: {
      version: readVersion("@playwright/test"),
      binaries: browserFiles,
      launcher: launchInputs([
        "scripts/verification/verification-process.mjs",
        "scripts/verification/browser-spawn-tracker.mjs",
        "scripts/verification/browser-session.mjs",
      ]),
    },
    next: {
      version: readVersion("next"),
      launcher: launchInputs([
        "scripts/verification/verification-process.mjs",
        "scripts/verification/verification-lifecycle.mjs",
        "scripts/verification/verification-lifecycle.sh",
        "scripts/dev/agent-dev.sh",
        "scripts/dev/runtime-servers.mjs",
        "scripts/dev/runtime-servers.cjs",
        "scripts/verification/e2e-web-server.sh",
      ]),
    },
  };
  const backend = path.join(
    root,
    "zlocal/.convex-local-backend/convex-local-backend"
  );
  if (requiredComponents(root, operation).includes("convex")) {
    if (!fs.existsSync(backend))
      throw new Error(
        "Missing declared Convex backend. No owned server was started."
      );
    components.convex = {
      version: readVersion("convex"),
      binary: fileDigest(backend),
      launcher: launchInputs([
        "scripts/verification/verification-process.mjs",
        "scripts/verification/verification-lifecycle.mjs",
        "scripts/verification/verification-lifecycle.sh",
        "scripts/verification/e2e-convex-backend.sh",
        "scripts/dev/agent-dev.sh",
      ]),
    };
  }
  const keys = Object.fromEntries(
    requiredComponents(root, operation).map((name) => [
      name,
      digest(
        stableJSON({
          runtime: { ...runtime, declarations: undefined },
          context,
          component: components[name],
        })
      ),
    ])
  );
  return {
    fingerprint: digest(stableJSON({ runtime, context, components })),
    runtimeFingerprint: digest(stableJSON({ runtime, components })),
    facts: { ...runtime, context, components },
    keys,
  };
}
export function compatibilityStore() {
  return path.join(os.homedir(), ".local/state/ui-library-agent-browser");
}
export function readCompatibility() {
  try {
    const root = os.homedir();
    const file = safePath(
      root,
      ".local/state/ui-library-agent-browser/compatibility.json"
    );
    return fs.existsSync(file)
      ? readJSON(file)
      : { version: 2, components: {} };
  } catch {
    return { version: 2, components: {}, unavailable: true };
  }
}
export function initialRoute(identity, evidence, store = readCompatibility()) {
  if (
    evidence?.environments?.some(
      (entry) =>
        entry.fingerprint === identity.fingerprint && entry.route === "reviewed"
    )
  )
    return "reviewed";
  const context = identity.facts?.context;
  if (!context?.known || !context.restricted)
    return context?.known && !context.restricted ? "host" : "reviewed";
  return store.version === 2 &&
    Object.values(identity.keys ?? {}).every(
      (key) => store.components?.[key]?.sandboxPassed === true
    )
    ? "sandbox"
    : "reviewed";
}
export function saveCompatibility(identity, route, passedComponents) {
  // Reviewed success never establishes sandbox support, and never carries approval.
  const receipt = {
    version: 2,
    at: new Date().toISOString(),
    context: identity.facts.context,
    components: passedComponents.map((name) => ({
      name,
      key: identity.keys[name],
      sandboxPassed: route === "sandbox",
    })),
  };
  return { receipt, saved: mergeCompatibilityReceipt(receipt) };
}
export function mergeCompatibilityReceipt(receipt) {
  let lock, token;
  try {
    const file = safePath(
      os.homedir(),
      ".local/state/ui-library-agent-browser/compatibility.json",
      true
    );
    lock = safePath(
      os.homedir(),
      ".local/state/ui-library-agent-browser/write.lock"
    );
    token = randomUUID();
    fs.writeFileSync(lock, token, { flag: "wx", mode: 0o600 });
    const store = readCompatibility();
    if (
      store.unavailable ||
      store.version !== 2 ||
      !Array.isArray(receipt.components)
    )
      return false;
    for (const item of receipt.components) {
      if (
        !/^[a-f0-9]{64}$/.test(item.key ?? "") ||
        typeof item.sandboxPassed !== "boolean"
      )
        throw new Error("Invalid component compatibility receipt.");
      store.components[item.key] = {
        ...store.components[item.key],
        [item.sandboxPassed ? "sandboxPassed" : "hostPassed"]: true,
        at: receipt.at,
      };
    }
    atomicJSON(file, store);
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (
        lock &&
        token &&
        fs.existsSync(lock) &&
        !fs.lstatSync(lock).isSymbolicLink() &&
        fs.readFileSync(lock, "utf8") === token
      )
        fs.unlinkSync(lock);
    } catch {
      /* Cache availability never changes a verification result. */
    }
  }
}
