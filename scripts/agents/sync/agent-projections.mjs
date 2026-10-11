// Generate from an index snapshot and stage only declared projection files.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  packageRuntimeFields,
  projectPackage,
  readRuntime,
} from "../runtime/agent-runtime.mjs";
import { atomicJSON, digest, safePath } from "../shared/agent-data.mjs";

const outputs = {
  runtime: ["package.json"],
  rules: ["AGENTS.md", ".claude/rules"],
  providers: [
    "CLAUDE.md",
    ".cursor/hooks.json",
    ".cursor/permissions.json",
    ".cursor/cli.json",
    ".claude/settings.json",
    ".codex/hooks.json",
  ],
};
export function generateStaged(root, kind) {
  if (!outputs[kind])
    throw new Error("Projection kind must be runtime, rules or providers.");
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const realEnv = { ...process.env };
  delete realEnv.GIT_INDEX_FILE;
  const realGit = (...args) =>
    execFileSync("git", args, { cwd: root, env: realEnv });
  const index = path.resolve(
    root,
    git("rev-parse", "--git-path", "index").toString().trim()
  );
  const original = fs.readFileSync(index);
  const realIndex = path.resolve(
    root,
    realGit("rev-parse", "--git-path", "index").toString().trim()
  );
  const snapshot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "agent-projections-"))
  );
  const entries = git(
    "ls-files",
    "--stage",
    "-z",
    "--",
    ".agents/rules",
    ".agents/hooks",
    ".agents/sync-policy.json",
    ".agents/environment.json",
    ".node-version",
    ".nvmrc",
    "scripts/agents/runtime/agent-runtime.mjs",
    "AGENTS.md",
    "scripts/agents/sync/sync-agents-rules.ts",
    "scripts/agents/sync/sync-agents-providers.ts",
    ...outputs[kind]
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  const indexed = new Map();
  let lock;
  const written = [];
  try {
    for (const entry of entries) {
      const match = /^(100644|100755) ([0-9a-f]+) 0\t(.+)$/.exec(entry);
      if (!match)
        throw new Error(
          "Projection inputs must be regular, resolved index entries."
        );
      const [, , hash, relative] = match;
      const bytes = git("cat-file", "blob", hash);
      indexed.set(relative, bytes);
      const file = safePath(snapshot, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    if (kind === "runtime" && !indexed.has(".agents/environment.json"))
      return [];
    if (kind === "runtime") {
      execFileSync(
        process.execPath,
        ["scripts/agents/runtime/agent-runtime.mjs", "sync"],
        {
          cwd: snapshot,
        }
      );
    } else {
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          `scripts/agents/sync/sync-agents-${kind}.ts`,
        ],
        {
          cwd: snapshot,
          stdio: "pipe",
          env: { ...process.env, AGENT_PROJECT_ROOT: snapshot },
        }
      );
    }
    const isOutput = (rel) =>
      outputs[kind].some(
        (output) =>
          rel === output || (kind === "rules" && rel.startsWith(`${output}/`))
      );
    const generated = new Map();
    const walk = (directory, relative) => {
      if (!fs.existsSync(directory)) return;
      if (fs.statSync(directory).isFile()) {
        generated.set(relative, fs.readFileSync(directory));
        return;
      }
      for (const entry of fs.readdirSync(directory))
        walk(path.join(directory, entry), `${relative}/${entry}`);
    };
    for (const output of outputs[kind])
      walk(path.join(snapshot, output), output);
    const changes = [];
    for (const rel of new Set(
      [...indexed.keys()].filter(isOutput).concat([...generated.keys()])
    )) {
      const before = indexed.get(rel);
      const after = generated.get(rel);
      if (before?.equals(after ?? Buffer.alloc(0)) || (!before && !after))
        continue;
      const dest = safePath(root, rel);
      const live = fs.existsSync(dest) ? fs.readFileSync(dest) : undefined;
      if (
        kind !== "runtime" &&
        !(
          live?.equals(before ?? Buffer.alloc(0)) ||
          live?.equals(after ?? Buffer.alloc(0)) ||
          (!live && !before)
        )
      )
        throw new Error(`Unstaged projection changes preserved: ${rel}`);
      let worktreeAfter = after;
      if (kind === "runtime") {
        const runtime = readRuntime(snapshot);
        const actual = JSON.parse(live),
          prior = JSON.parse(before),
          next = JSON.parse(after);
        const fields = (pkg) =>
          JSON.stringify(packageRuntimeFields(pkg, runtime.projectEngines));
        if (fields(actual) !== fields(prior) && fields(actual) !== fields(next))
          throw new Error(
            "Unstaged runtime field changes preserved: package.json"
          );
        worktreeAfter = Buffer.from(
          JSON.stringify(projectPackage(actual, runtime), null, 2) + "\n"
        );
      }
      changes.push({ rel, dest, live, after, worktreeAfter });
    }
    if (!changes.length) return [];
    // Hold Git's conventional lock throughout the isolated index update.
    lock = fs.openSync(`${index}.lock`, "wx", 0o600);
    if (!fs.readFileSync(index).equals(original))
      throw new Error(
        "Git index changed during generation. Retry without overwriting it."
      );
    const temporaryIndex = path.join(snapshot, "index");
    fs.writeFileSync(temporaryIndex, original);
    for (const change of changes) {
      fs.mkdirSync(path.dirname(change.dest), { recursive: true });
      if (change.worktreeAfter)
        fs.writeFileSync(change.dest, change.worktreeAfter);
      else fs.unlinkSync(change.dest);
      written.push(change);
    }
    const temporaryEnv = { ...process.env, GIT_INDEX_FILE: temporaryIndex };
    if (kind === "runtime") {
      for (const change of changes) {
        const oid = execFileSync("git", ["hash-object", "-w", "--stdin"], {
          cwd: root,
          input: change.after,
          encoding: "utf8",
        }).trim();
        execFileSync(
          "git",
          [
            "update-index",
            "--add",
            "--cacheinfo",
            `100644,${oid},${change.rel}`,
          ],
          { cwd: root, env: temporaryEnv }
        );
      }
    } else {
      execFileSync(
        "git",
        ["add", "--", ...changes.map((change) => change.rel)],
        { cwd: root, env: temporaryEnv }
      );
    }
    if (index !== realIndex) {
      const stagedEntry = (rel, env) =>
        execFileSync("git", ["ls-files", "--stage", "-z", "--", rel], {
          cwd: root,
          env,
        }).toString();
      const head = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
        cwd: root,
        env: realEnv,
        encoding: "utf8",
      }).trim();
      atomicJSON(
        path.join(
          root,
          "zlocal/artifacts/agent-projections",
          `${kind}-${digest(index)}.json`
        ),
        {
          version: 1,
          kind,
          headBefore: head,
          changes: changes.map(({ rel }) => ({
            rel,
            before: stagedEntry(rel, realEnv),
            ...(kind === "runtime"
              ? {
                  runtime: readRuntime(snapshot),
                  runtimeBefore: packageRuntimeFields(
                    JSON.parse(indexed.get(rel)),
                    readRuntime(snapshot).projectEngines
                  ),
                }
              : {}),
            after: stagedEntry(rel, {
              ...process.env,
              GIT_INDEX_FILE: temporaryIndex,
            }),
          })),
        }
      );
    }
    fs.writeFileSync(lock, fs.readFileSync(temporaryIndex));
    fs.closeSync(lock);
    lock = undefined;
    fs.renameSync(`${index}.lock`, index);
    return changes.map((change) => change.rel);
  } catch (error) {
    for (const change of written.reverse()) {
      const current = fs.existsSync(change.dest)
        ? fs.readFileSync(change.dest)
        : undefined;
      if (!(
        current?.equals(change.worktreeAfter ?? Buffer.alloc(0)) ||
        (!current && !change.worktreeAfter)
      ))
        continue;
      if (change.live) fs.writeFileSync(change.dest, change.live);
      else fs.rmSync(change.dest, { force: true });
    }
    throw error;
  } finally {
    if (lock !== undefined) {
      fs.closeSync(lock);
      fs.unlinkSync(`${index}.lock`);
    }
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

// Git --only commits a temporary index, then installs its separately prepared
// real index. Reconcile only generated entries still equal to the recorded
// pre-hook index. Never read worktree bytes or alter unrelated staged entries.
export function finalizeProjections(root) {
  const directory = path.join(root, "zlocal/artifacts/agent-projections");
  if (!fs.existsSync(directory)) return { reconciled: [], conflicts: [] };
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, env, encoding: "utf8" });
  let parent;
  let previous;
  try {
    parent = git("rev-parse", "HEAD^").trim();
  } catch {
    /* Initial commit. */
  }
  try {
    previous = git("rev-parse", "HEAD@{1}").trim();
  } catch {
    /* Reflog unavailable. */
  }
  const objectLength =
    git("rev-parse", "--show-object-format").trim() === "sha256" ? 64 : 40;
  const index = path.resolve(
    root,
    git("rev-parse", "--git-path", "index").trim()
  );
  const reconciled = [],
    conflicts = [];
  for (const name of fs
    .readdirSync(directory)
    .filter((name) =>
      /^(runtime|rules|providers)-[a-f0-9]{64}\.json$/.test(name)
    )) {
    const file = safePath(directory, name);
    const journal = JSON.parse(fs.readFileSync(file));
    if (
      journal.version !== 1 ||
      !outputs[journal.kind] ||
      !Array.isArray(journal.changes)
    )
      throw new Error("Invalid projection reconciliation record.");
    if (journal.headBefore !== parent && journal.headBefore !== previous)
      continue;
    const changes = [];
    for (const change of journal.changes) {
      if (
        typeof change.rel !== "string" ||
        !outputs[journal.kind].some(
          (output) =>
            change.rel === output ||
            (journal.kind === "rules" && change.rel.startsWith(output + "/"))
        )
      )
        throw new Error("Reconciliation output escapes its projection list.");
      safePath(root, change.rel);
      const entry = git("ls-files", "--stage", "-z", "--", change.rel);
      const tree = git("ls-tree", "-z", "HEAD", "--", change.rel);
      const expectedTree = change.after.replace(
        /^(100644|100755) ([a-f0-9]+) 0\t/,
        "$1 blob $2\t"
      );
      if (tree !== expectedTree)
        throw new Error(
          "Committed projection does not match its reconciliation record."
        );
      if (entry === change.after) continue;
      if (entry !== change.before) {
        conflicts.push(change.rel);
        continue;
      }
      if (journal.kind === "runtime") {
        const oid = /^100644 ([a-f0-9]+) 0\t/.exec(entry)?.[1];
        if (!oid)
          throw new Error(
            "Runtime reconciliation needs a regular package.json entry."
          );
        const current = JSON.parse(git("cat-file", "blob", oid));
        const fields = packageRuntimeFields(
          current,
          change.runtime.projectEngines
        );
        const next = projectPackage(current, change.runtime);
        if (
          JSON.stringify(fields) !== JSON.stringify(change.runtimeBefore) &&
          JSON.stringify(fields) !==
            JSON.stringify(
              packageRuntimeFields(next, change.runtime.projectEngines)
            )
        ) {
          conflicts.push(change.rel);
          continue;
        }
        const merged = execFileSync("git", ["hash-object", "-w", "--stdin"], {
          cwd: root,
          env,
          input: JSON.stringify(next, null, 2) + "\n",
          encoding: "utf8",
        }).trim();
        changes.push({
          ...change,
          after: `100644 ${merged} 0\t${change.rel}\0`,
        });
      } else changes.push(change);
    }
    if (!changes.length) {
      if (!conflicts.length) fs.unlinkSync(file);
      continue;
    }
    const original = fs.readFileSync(index);
    const lock = fs.openSync(index + ".lock", "wx", 0o600);
    const temporary = path.join(directory, name + ".index");
    let installed = false;
    try {
      if (!fs.readFileSync(index).equals(original))
        throw new Error("Real Git index changed during reconciliation.");
      fs.writeFileSync(temporary, original);
      const info = changes
        .map(
          ({ rel, after }) => after || `0 ${"0".repeat(objectLength)}\t${rel}\0`
        )
        .join("");
      execFileSync("git", ["update-index", "-z", "--index-info"], {
        cwd: root,
        env: { ...env, GIT_INDEX_FILE: temporary },
        input: info,
      });
      fs.writeFileSync(lock, fs.readFileSync(temporary));
      fs.renameSync(index + ".lock", index);
      installed = true;
      reconciled.push(...changes.map(({ rel }) => rel));
      if (!conflicts.length) fs.unlinkSync(file);
    } finally {
      fs.closeSync(lock);
      if (!installed) fs.rmSync(index + ".lock", { force: true });
      fs.rmSync(temporary, { force: true });
    }
  }
  return { reconciled, conflicts };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: agent-projections.mjs runtime|rules|providers|finalize"
      );
    const result =
      process.argv[2] === "finalize"
        ? finalizeProjections(process.cwd())
        : generateStaged(process.cwd(), process.argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.conflicts?.length) {
      process.stderr.write(
        `Generated index conflicts preserved: ${result.conflicts.join(", ")}. Inspect and retry projection finalization.\n`
      );
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
