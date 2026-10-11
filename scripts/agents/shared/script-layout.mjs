// Canonical project script paths. Legacy resolution is read-only.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import layout from "./script-layout.json" with { type: "json" };

export const scriptEntries = layout.scripts;
export const consolidation = layout.consolidation;
export function scriptBundle(name) {
  const names = layout.bundles?.[name];
  if (!names) throw new Error(`Unknown script bundle: ${name}`);
  return names.map(scriptPath);
}
export function expandScriptMirrors(text) {
  return [
    ...new Set(
      text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .flatMap((line) => {
          if (!line.startsWith("@bundle ")) return [line];
          return scriptBundle(line.slice(8));
        })
    ),
  ];
}
export function assertConsolidated(root, { rules = [] } = {}) {
  const legacy = [".agents/browser-environments.json", ...rules].filter(
    (relative) => fs.existsSync(path.join(root, relative))
  );
  if (legacy.length)
    throw new Error(
      `Explicit agent consolidation required before installation: ${legacy.join(", ")}. Run scripts:migrate --project PROJECT --source UI_LIBRARY --consolidate, review the plan, then repeat with --apply.`
    );
}

export function scriptPath(name) {
  const entry = scriptEntries[name];
  if (!entry) throw new Error(`Unknown project script: ${name}`);
  return entry.path;
}

export function resolveScript(root, name) {
  const current = path.join(root, scriptPath(name));
  const legacy = path.join(root, "scripts", name);
  if (fs.existsSync(current)) return current;
  if (fs.existsSync(legacy)) return legacy;
  throw new Error(`Project script is missing: ${scriptPath(name)}`);
}

export function assertScriptLayout(root) {
  const legacy = Object.keys(scriptEntries).filter((name) =>
    fs.existsSync(path.join(root, "scripts", name))
  );
  if (legacy.length)
    throw new Error(
      `Legacy flat scripts require explicit migration before installation: ${legacy.join(", ")}. Run migrate-script-layout.mjs --project PROJECT --source UI_LIBRARY, review its plan, then repeat with --apply.`
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [command, root, name] = process.argv.slice(2);
    if (command !== "resolve" || !root || !name)
      throw new Error("Usage: script-layout.mjs resolve PROJECT SCRIPT_NAME");
    process.stdout.write(`${resolveScript(root, name)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
