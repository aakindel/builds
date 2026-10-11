// agent-worktrees-managed: 1
// Runtime declarations are data. This module has no package dependencies.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tuple = (value) => value.replace(/^v/, "").split(".").map(Number);
const compare = (a, b) =>
  a[0] - b[0] || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0);
export function satisfies(version, requirement) {
  const current = tuple(version);
  if (current.some(Number.isNaN)) return false;
  return requirement.split("||").some((alternative) => {
    const expression = alternative
      .trim()
      .replace(/(\d[\d.]*)\s+-\s+(\d[\d.]*)/g, ">=$1 <=$2")
      .replace(/([<>]=?)\s+/g, "$1");
    return expression.split(/\s+/).every((part) => {
      if (!part || part === "*" || /^x$/i.test(part)) return true;
      const match =
        /^(>=|<=|>|<|=|\^|~)?v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/i.exec(
          part
        );
      if (!match)
        throw new Error(
          `Unsupported version requirement: ${requirement}. Use a numeric pin or supported semver range.`
        );
      const [, op = "", major, minor, patch] = match;
      const wanted = [Number(major), Number(minor) || 0, Number(patch) || 0];
      const order = compare(current, wanted);
      const partial = !/^\d+$/.test(minor ?? "")
        ? 1
        : !/^\d+$/.test(patch ?? "")
          ? 2
          : 3;
      const upper =
        partial === 1 ? [wanted[0] + 1, 0, 0] : [wanted[0], wanted[1] + 1, 0];
      if (op === ">=") return order >= 0;
      if (op === "<=")
        return partial < 3 ? compare(current, upper) < 0 : order <= 0;
      if (op === ">")
        return partial < 3 ? compare(current, upper) >= 0 : order > 0;
      if (op === "<") return order < 0;
      if (op === "^")
        return (
          order >= 0 &&
          compare(
            current,
            wanted[0] || partial === 1
              ? [wanted[0] + 1, 0, 0]
              : wanted[1] || partial === 2
                ? [0, wanted[1] + 1, 0]
                : [0, 0, wanted[2] + 1]
          ) < 0
        );
      if (op === "~")
        return (
          order >= 0 &&
          compare(
            current,
            minor === undefined
              ? [wanted[0] + 1, 0, 0]
              : [wanted[0], wanted[1] + 1, 0]
          ) < 0
        );
      return (
        current[0] === wanted[0] &&
        (!/^\d+$/.test(minor ?? "") || current[1] === wanted[1]) &&
        (!/^\d+$/.test(patch ?? "") || current[2] === wanted[2])
      );
    });
  });
}

export const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function packageManagerVersion(spec) {
  return spec.slice(5).split("+")[0];
}
export function validPackageManager(spec) {
  if (typeof spec !== "string" || !spec.startsWith("pnpm@")) return false;
  const [version, integrity, extra] = spec.slice(5).split("+");
  if (!exactVersion.test(version) || extra !== undefined) return false;
  if (integrity === undefined) return true;
  const match = /^(sha224|sha256|sha384|sha512)\.([a-fA-F0-9]+)$/.exec(
    integrity
  );
  return Boolean(
    match &&
    match[2].length ===
      { sha224: 56, sha256: 64, sha384: 96, sha512: 128 }[match[1]]
  );
}
export function validateRuntime(runtime) {
  if (
    !runtime ||
    Array.isArray(runtime) ||
    typeof runtime !== "object" ||
    typeof runtime.node !== "string" ||
    !exactVersion.test(runtime.node) ||
    !validPackageManager(runtime.packageManager) ||
    (runtime.projectEngines !== undefined &&
      typeof runtime.projectEngines !== "boolean")
  )
    throw new Error(
      "environment.json needs exact runtime.node and runtime.packageManager pins, for example 24.2.0 and pnpm@11.24.0; projectEngines must be boolean."
    );
  return {
    node: runtime.node,
    packageManager: runtime.packageManager,
    projectEngines: runtime.projectEngines === true,
  };
}
export function validateEnvironment(policy) {
  if (
    !policy ||
    Array.isArray(policy) ||
    typeof policy !== "object" ||
    policy.version !== 1
  )
    throw new Error("Unsupported environment.json version or shape.");
  if (Object.hasOwn(policy, "runtime")) validateRuntime(policy.runtime);
  if (Object.hasOwn(policy, "browserVerification")) {
    const browser = policy.browserVerification;
    if (
      !browser ||
      Array.isArray(browser) ||
      typeof browser !== "object" ||
      (browser.version !== undefined && ![1, 2].includes(browser.version)) ||
      !Array.isArray(browser.environments)
    )
      throw new Error(
        "environment.json browserVerification.environments must be an array."
      );
    const fingerprints = new Set();
    for (const entry of browser.environments) {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        !/^[a-f0-9]{64}$/.test(entry.fingerprint ?? "") ||
        !["reviewed", "sandbox"].includes(entry.route) ||
        typeof entry.reason !== "string" ||
        !entry.reason.trim() ||
        fingerprints.has(entry.fingerprint)
      )
        throw new Error(
          "Invalid or duplicate browser environment routing evidence."
        );
      fingerprints.add(entry.fingerprint);
    }
  }
  return policy;
}
export function readEnvironment(root, { required = false } = {}) {
  const file = path.join(root, ".agents/environment.json");
  if (!fs.existsSync(file)) {
    if (!required) return { version: 1 };
    throw new Error(
      "Missing .agents/environment.json; install agent-environment first."
    );
  }
  return validateEnvironment(JSON.parse(fs.readFileSync(file, "utf8")));
}
// Stable effective inputs exclude routing evidence, so evidence cannot invalidate itself.
export function environmentInputs(policy) {
  validateEnvironment(policy);
  const { browserVerification, ...inputs } = policy;
  if (Object.hasOwn(inputs, "runtime"))
    inputs.runtime = { ...inputs.runtime, ...validateRuntime(inputs.runtime) };
  if (browserVerification) {
    const settings = { ...browserVerification };
    delete settings.environments;
    if (Object.keys(settings).length) inputs.browserVerification = settings;
  }
  return stableJSON(inputs);
}
export function stableJSON(value) {
  const sort = (value) =>
    Array.isArray(value)
      ? value.map(sort)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, sort(value[key])])
          )
        : value;
  return JSON.stringify(sort(value));
}
export function readRuntime(root, { required = true } = {}) {
  const policy = readEnvironment(root, { required });
  if (!Object.hasOwn(policy, "runtime")) {
    if (!required) return undefined;
    throw new Error(
      "environment.json needs exact runtime.node and runtime.packageManager pins."
    );
  }
  return validateRuntime(policy.runtime);
}
export function legacyRequirements(root) {
  return [".nvmrc", ".node-version"]
    .filter((name) => fs.existsSync(path.join(root, name)))
    .map((name) => fs.readFileSync(path.join(root, name), "utf8").trim());
}
export function compatibleRuntime(
  root,
  runtime,
  pkg,
  { projection = false } = {}
) {
  if (pkg.devEngines?.runtime || pkg.engines?.runtime)
    throw new Error(
      "Resolve managed runtime declarations before using prepared runtimes."
    );
  const nodeRequirements = [
    ...legacyRequirements(root),
    ...(!runtime.projectEngines && pkg.engines?.node ? [pkg.engines.node] : []),
  ];
  if (nodeRequirements.some((pin) => !satisfies(runtime.node, pin)))
    throw new Error(
      "environment.json Node pin conflicts with existing Node requirements. Preserve and resolve the declarations."
    );
  for (const requirement of [
    pkg.engines?.pnpm,
    pkg.devEngines?.packageManager?.version,
  ].filter(Boolean))
    if (!satisfies(packageManagerVersion(runtime.packageManager), requirement))
      throw new Error(
        "environment.json pnpm pin conflicts with package requirements."
      );
  if (
    pkg.devEngines?.packageManager &&
    (Array.isArray(pkg.devEngines.packageManager) ||
      pkg.devEngines.packageManager.name !== "pnpm")
  )
    throw new Error("Unsupported devEngines.packageManager declaration.");
  if (
    projection &&
    (pkg.packageManager !== runtime.packageManager ||
      (runtime.projectEngines && pkg.engines?.node !== runtime.node))
  )
    throw new Error(
      "Generated package runtime fields are stale. Run node scripts/agents/runtime/agent-runtime.mjs sync before installation."
    );
  return runtime;
}
export function projectPackage(pkg, runtime) {
  return {
    ...pkg,
    ...(runtime.projectEngines
      ? { engines: { ...pkg.engines, node: runtime.node } }
      : {}),
    packageManager: runtime.packageManager,
  };
}
export function packageRuntimeFields(pkg, projectEngines) {
  return {
    ...(projectEngines ? { node: pkg.engines?.node } : {}),
    packageManager: pkg.packageManager,
  };
}
export function synchronizeRuntime(root, { check = false } = {}) {
  const runtime = readRuntime(root, { required: false });
  if (!runtime) return { skipped: "no-environment-policy" };
  const file = path.join(root, "package.json");
  const before = fs.readFileSync(file, "utf8"),
    pkg = JSON.parse(before);
  compatibleRuntime(root, runtime, pkg, { projection: check });
  const next = projectPackage(pkg, runtime);
  const changed =
    JSON.stringify(packageRuntimeFields(pkg, runtime.projectEngines)) !==
    JSON.stringify(packageRuntimeFields(next, runtime.projectEngines));
  if (changed && !check) {
    if (fs.readFileSync(file, "utf8") !== before)
      throw new Error("package.json changed during runtime generation; retry.");
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  }
  return { runtime, changed };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (
      process.argv.length !== 3 ||
      !["sync", "check"].includes(process.argv[2])
    )
      throw new Error("Usage: agent-runtime.mjs sync|check");
    process.stdout.write(
      JSON.stringify(
        synchronizeRuntime(process.cwd(), {
          check: process.argv[2] === "check",
        })
      ) + "\n"
    );
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
