// Explicit migration only. The default operation prepares a read-only plan.

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  environmentInputs,
  stableJSON,
  validateEnvironment,
} from "../runtime/agent-runtime.mjs";
import {
  consolidation,
  scriptBundle,
  scriptEntries,
} from "./script-layout.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function safeFile(root, relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes(".."))
    throw new Error(`Unsafe migration path: ${relative}`);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep))
    throw new Error("Path escapes project.");
  for (let current = file; current !== root; current = path.dirname(current)) {
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink())
      throw new Error(`Symlink preserved: ${current}`);
  }
  return file;
}

export function planScriptMigration(root, { source, entries = scriptEntries }) {
  root = fs.realpathSync(root);
  source = fs.realpathSync(source);
  const moves = [];
  for (const [name, entry] of Object.entries(entries)) {
    const old = safeFile(root, `scripts/${name}`);
    if (!fs.existsSync(old)) continue;
    if (!fs.statSync(old).isFile())
      throw new Error(`Non-file preserved: ${old}`);
    const before = fs.readFileSync(old);
    if (!entry.legacyHashes.includes(hash(before)))
      throw new Error(
        `Customized or unknown legacy script preserved: scripts/${name}`
      );
    let sourceRel = entry.path;
    if (fs.existsSync(path.join(root, "convex"))) {
      const convex = `.agents/_root-agents/skills/agent-skills/agent-isolation/add-agent-isolation/references/convex/${entry.path}`;
      if (fs.existsSync(path.join(source, convex))) sourceRel = convex;
    }
    const incoming = safeFile(source, sourceRel);
    const after = fs.readFileSync(incoming);
    const dest = safeFile(root, entry.path);
    if (fs.existsSync(dest) && !fs.readFileSync(dest).equals(after))
      throw new Error(`Customized destination preserved: ${entry.path}`);
    moves.push({
      old: `scripts/${name}`,
      new: entry.path,
      before,
      after,
      mode: fs.statSync(old).mode & 0o777,
    });
  }
  const changes = [];
  const additions = [];
  if (moves.length) {
    const needed = new Set([
      "script-layout.mjs",
      "script-layout.json",
      "migrate-script-layout.mjs",
      "agent-runtime.mjs",
    ]);
    const collectDependencies = (name) => {
      for (const dependency of entries[name]?.dependencies ?? []) {
        if (!entries[dependency])
          throw new Error("Unknown migration dependency: " + dependency);
        if (!needed.has(dependency)) {
          needed.add(dependency);
          collectDependencies(dependency);
        }
      }
    };
    for (const move of moves) collectDependencies(path.basename(move.old));
    for (const name of needed) {
      if (!entries[name]) continue;
      if (moves.some((move) => move.new === entries[name].path)) continue;
      const relative = entries[name].path;
      const incoming = safeFile(source, relative);
      const after = fs.readFileSync(incoming);
      const destination = safeFile(root, relative);
      if (fs.existsSync(destination)) {
        if (!fs.readFileSync(destination).equals(after))
          throw new Error(`Customized layout helper preserved: ${relative}`);
      } else
        additions.push({
          new: relative,
          after,
          mode: fs.statSync(incoming).mode & 0o777,
        });
    }
    const files = [
      "package.json",
      ".prettierrc.json",
      "lint-staged.config.mjs",
      "lint-staged.config.js",
      "playwright.config.ts",
      "playwright.agent.config.ts",
      "playwright.alignment.config.ts",
      ".cursor/worktrees.json",
      ".agents/environment.json",
      "README.md",
    ];
    const walk = (rel) => {
      const directory = safeFile(root, rel);
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === "_") continue;
        const child = `${rel}/${entry.name}`;
        if (entry.isSymbolicLink())
          throw new Error(`Symlink preserved: ${child}`);
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile()) files.push(child);
      }
    };
    for (const rel of [".agents/hooks", ".agents/rules", ".husky"]) walk(rel);
    for (const relative of new Set(files)) {
      const file = safeFile(root, relative);
      if (!fs.existsSync(file)) continue;
      const before = fs.readFileSync(file);
      let text = before.toString();
      for (const [name, entry] of Object.entries(entries))
        text = text.replaceAll(`scripts/${name}`, entry.path);
      const after = Buffer.from(text);
      if (!before.equals(after))
        changes.push({
          new: relative,
          before,
          after,
          mode: fs.statSync(file).mode & 0o777,
        });
    }
  }
  return { root, source, moves, changes, additions };
}

export function applyScriptMigration(
  plan,
  { rename = fs.renameSync, unlink = fs.unlinkSync } = {}
) {
  const { root, moves, changes, additions = [], deletions = [] } = plan;
  if (![...moves, ...changes, ...additions, ...deletions].length)
    return { moved: [], changed: [] };
  for (const item of [...moves, ...changes, ...deletions]) {
    if (
      !fs.readFileSync(safeFile(root, item.old ?? item.new)).equals(item.before)
    )
      throw new Error("Project changed after planning; no files changed.");
    if (
      item.old &&
      fs.existsSync(safeFile(root, item.new)) &&
      !fs.readFileSync(safeFile(root, item.new)).equals(item.after)
    )
      throw new Error("Destination changed after planning; no files changed.");
  }
  for (const item of additions) {
    if (fs.existsSync(safeFile(root, item.new)))
      throw new Error("Destination changed after planning; no files changed.");
  }
  const backup = safeFile(
    root,
    `zlocal/artifacts/script-layout-migrations/${randomUUID()}`
  );
  fs.mkdirSync(backup, { recursive: true });
  const records = [...moves, ...changes, ...additions, ...deletions].map(
    (item) => ({
      ...item,
      priorDestination:
        item.old && fs.existsSync(safeFile(root, item.new))
          ? fs.readFileSync(safeFile(root, item.new))
          : undefined,
      priorDestinationMode:
        item.old && fs.existsSync(safeFile(root, item.new))
          ? fs.statSync(safeFile(root, item.new)).mode & 0o777
          : undefined,
    })
  );
  const write = (relative, bytes, mode) => {
    const file = safeFile(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.layout-${randomUUID()}`;
    try {
      fs.writeFileSync(temporary, bytes, { flag: "wx", mode });
      fs.chmodSync(temporary, mode);
      rename(temporary, file);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  };
  fs.writeFileSync(
    path.join(backup, "originals.json"),
    JSON.stringify(
      records.map((item) => ({
        ...item,
        before: item.before?.toString("base64"),
        after: item.after?.toString("base64"),
        priorDestination: item.priorDestination?.toString("base64"),
      })),
      null,
      2
    ) + "\n"
  );
  const written = [];
  try {
    for (const item of records.filter((record) => !record.delete)) {
      write(item.new, item.after, item.mode);
      written.push(item);
    }
    for (const item of [...moves, ...deletions])
      unlink(safeFile(root, item.old ?? item.new));
  } catch (error) {
    for (const item of records.filter((record) => record.before))
      write(item.old ?? item.new, item.before, item.mode);
    for (const item of written.filter(
      (record) => record.old || !record.before
    )) {
      if (item.priorDestination)
        write(item.new, item.priorDestination, item.priorDestinationMode);
      else fs.rmSync(safeFile(root, item.new), { force: true });
    }
    throw error;
  }
  return {
    moved: moves.map(({ old, new: target }) => ({ old, new: target })),
    changed: [...changes, ...additions].map(({ new: target }) => target),
    ...(deletions.length ? { removed: deletions.map((item) => item.new) } : {}),
    backup: path.relative(root, backup),
  };
}

// This migration is explicit and never runs as a side effect of verification.
export function planAgentConsolidation(
  root,
  { source, observed, metadata = consolidation } = {}
) {
  root = fs.realpathSync(root);
  source = fs.realpathSync(source);
  const changes = [],
    additions = [],
    deletions = [];
  const exists = (relative) => fs.existsSync(safeFile(root, relative));
  const item = (relative) => {
    const file = safeFile(root, relative);
    if (!fs.statSync(file).isFile())
      throw new Error(`Non-file preserved: ${relative}`);
    return {
      new: relative,
      before: fs.readFileSync(file),
      mode: fs.statSync(file).mode & 0o777,
    };
  };
  for (const [relative, hashes] of Object.entries(metadata.retiredRules)) {
    if (!exists(relative)) continue;
    const record = item(relative);
    if (!hashes.includes(hash(record.before)))
      throw new Error(`Customized legacy rule preserved: ${relative}`);
    deletions.push({ ...record, delete: true });
  }
  const retiring = (name) =>
    deletions.some((record) => record.new === `.agents/rules/${name}.mdc`);
  const browser =
    exists("scripts/verification/browser-workflow.mjs") ||
    exists(".agents/browser-environments.json") ||
    retiring("browser-verification");
  const targets = new Set(Object.keys(metadata.files).filter(exists));
  if (retiring("verification-report")) {
    targets.add(".agents/rules/dev-depth.mdc");
    targets.add("scripts/dev/dev-depth.mjs");
  }
  if (browser) {
    for (const relative of scriptBundle("browser")) targets.add(relative);
    targets.add(".agents/rules/agent-environment.mdc");
  }
  if (retiring("tailwind-fix") || retiring("typecheck-fix"))
    targets.add(".agents/rules/general-fix.mdc");
  for (const relative of targets) {
    const incoming = safeFile(source, relative);
    const after = fs.readFileSync(incoming);
    if (exists(relative)) {
      const record = item(relative);
      if (record.before.equals(after)) continue;
      if (!metadata.files[relative]?.includes(hash(record.before)))
        throw new Error(
          `Customized consolidation destination preserved: ${relative}`
        );
      changes.push({ ...record, after });
    } else
      additions.push({
        new: relative,
        after,
        mode: fs.statSync(incoming).mode & 0o777,
      });
  }
  const relative = ".agents/environment.json";
  const record = exists(relative) ? item(relative) : null;
  const environment = record
    ? validateEnvironment(JSON.parse(record.before))
    : { version: 1 };
  const legacy = ".agents/browser-environments.json";
  if (exists(legacy)) {
    const old = item(legacy);
    const evidence = JSON.parse(old.before);
    if (evidence.version !== 1)
      throw new Error(
        "Unsupported legacy browser evidence version; file preserved."
      );
    const settings = { ...evidence };
    delete settings.version;
    validateEnvironment({ version: 1, browserVerification: settings });
    if (
      environment.browserVerification &&
      environmentInputs({
        version: 1,
        browserVerification: environment.browserVerification,
      }) !== environmentInputs({ version: 1, browserVerification: settings })
    )
      throw new Error(
        "Conflicting browser settings preserved; resolve before migration."
      );
    const entries = new Map(
      (environment.browserVerification?.environments ?? []).map((entry) => [
        entry.fingerprint,
        entry,
      ])
    );
    for (const entry of settings.environments) {
      const existing = entries.get(entry.fingerprint);
      if (existing && stableJSON(existing) !== stableJSON(entry))
        throw new Error(
          "Conflicting browser routing evidence preserved; resolve before migration."
        );
      entries.set(entry.fingerprint, entry);
    }
    environment.browserVerification = {
      ...settings,
      ...environment.browserVerification,
      environments: [...entries.values()],
    };
    deletions.push({ ...old, delete: true });
  } else if (browser && !environment.browserVerification)
    environment.browserVerification = { environments: [] };
  if (observed && exists(legacy) && environment.browserVerification) {
    const facts = observed.environment?.facts;
    if (
      observed.root !== root ||
      !facts ||
      hash(JSON.stringify(facts)) !== observed.environment.fingerprint ||
      facts.runtime !== (record ? hash(record.before) : null)
    )
      throw new Error(
        "Observed legacy environment does not match this project's original inputs."
      );
    // Legacy opaque hashes retain their original scope. Do not convert them into
    // a current component compatibility key or a permission grant.
    validateEnvironment(environment);
  }
  if (browser) {
    const after = Buffer.from(JSON.stringify(environment, null, 2) + "\n");
    if (
      record &&
      stableJSON(JSON.parse(record.before)) !== stableJSON(environment)
    )
      changes.push({ ...record, after });
    else if (!record) additions.push({ new: relative, after, mode: 0o644 });
  }
  return { root, source, moves: [], changes, additions, deletions };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    const value = (name) => args[args.indexOf(name) + 1];
    if (!args.includes("--project") || !args.includes("--source"))
      throw new Error(
        "Usage: migrate-script-layout.mjs --project PROJECT --source UI_LIBRARY [--consolidate] [--observed LEGACY_PLAN_JSON] [--apply]"
      );
    let observed = args.includes("--observed")
      ? JSON.parse(fs.readFileSync(value("--observed")))
      : undefined;
    observed = observed?.observed ?? observed;
    // A preview captures this process's current ordinary profile; callers may carry
    // that exact observation into a separately reviewed apply with --observed.
    if (!observed && args.includes("--consolidate")) {
      const root = fs.realpathSync(value("--project"));
      if (fs.existsSync(path.join(root, ".agents/browser-environments.json"))) {
        const browserModule = path.join(
          fs.realpathSync(value("--source")),
          "scripts/verification/browser-workflow.mjs"
        );
        if (
          fs.existsSync(path.join(root, "node_modules/@playwright/test")) &&
          fs.existsSync(browserModule)
        ) {
          const { environmentIdentity } = await import(
            pathToFileURL(browserModule)
          );
          process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
          const environment = environmentIdentity(root);
          const config = path.join(root, ".agents/environment.json");
          environment.facts.runtime = fs.existsSync(config)
            ? hash(fs.readFileSync(config))
            : null;
          environment.fingerprint = hash(JSON.stringify(environment.facts));
          observed = { root, environment };
        }
      }
    }
    const plan = (
      args.includes("--consolidate")
        ? planAgentConsolidation
        : planScriptMigration
    )(value("--project"), {
      source: value("--source"),
      observed,
    });
    process.stdout.write(
      JSON.stringify(
        args.includes("--apply")
          ? applyScriptMigration(plan)
          : {
              root: plan.root,
              ...(observed ? { observed } : {}),
              removed: (plan.deletions ?? []).map(({ new: target }) => target),
              moves: plan.moves.map(({ old, new: target }) => ({
                old,
                new: target,
              })),
              changes: [...plan.changes, ...plan.additions].map(
                ({ new: target }) => target
              ),
            },
        null,
        2
      ) + "\n"
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
