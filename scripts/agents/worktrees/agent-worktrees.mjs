// agent-worktrees-managed: 1

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoProjectServers } from "../../dev/runtime-servers.mjs";
import {
  baseline,
  carryLocal,
  changedFiles,
  migrateConfig,
  git as policyGit,
  run as policyRun,
  pullRequest,
  readConfig,
  remotePreflight,
  remoteRepository,
  taskEnvironment,
  toolchain,
} from "./agent-worktree-policy.mjs";

export { readConfig, toolchain } from "./agent-worktree-policy.mjs";

const providers = ["codex", "claude", "cursor", "t3"];
// T3 owns its worktrees through its own state, so it never binds a cloud clone.
const cloudHarnesses = ["codex", "claude", "cursor"];
const environmentFiles = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
];
const generatedDirectories = [
  ".husky/_/",
  "node_modules/",
  ".pnpm-store/",
  ".next/",
  ".next-agent/",
  ".next-e2e/",
  "out/",
  "build/",
  "coverage/",
  "test-results/",
  "playwright-report/",
  "blob-report/",
  "playwright/.cache/",
];

function execute(cwd, command, { inherit = false } = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: inherit ? ["ignore", 2, 2] : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(
      `${command[0]} ${command[1] ?? ""} failed (${result.status}): ${(result.stderr ?? "").trim()}`
    );
    error.exitCode = result.status;
    throw error;
  }
  return (result.stdout ?? "").trim();
}

function git(cwd, ...args) {
  return execute(cwd, ["git", ...args]);
}
function sha(cwd, ref = "HEAD") {
  return git(cwd, "rev-parse", "--verify", `${ref}^{commit}`);
}
function branch(cwd, allowDetached = false) {
  const outcome = spawnSync(
    "git",
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    { cwd, encoding: "utf8" }
  );
  if (allowDetached && outcome.status === 1) return null;
  if (outcome.error || outcome.status !== 0)
    throw new Error("A named branch is required for helper-owned workspaces.", {
      cause: outcome.error,
    });
  return outcome.stdout.trim();
}
function dirty(cwd) {
  return (
    git(cwd, "status", "--porcelain=v1", "--untracked-files=all", "-z") !== ""
  );
}
function ancestor(cwd, from, to) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", from, to], {
    cwd,
    encoding: "utf8",
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(
    `Cannot compare commits: ${result.stderr ?? result.error?.message}`
  );
}
function atomicJSON(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temp = `${filename}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temp, filename);
}

const t3Columns = {
  projection_threads: [
    "thread_id",
    "project_id",
    "branch",
    "worktree_path",
    "deleted_at",
  ],
  projection_projects: ["project_id", "workspace_root", "deleted_at"],
};
// Read-only host evidence: T3 records which thread owns each worktree it created.
export function t3Thread(primary, root) {
  const file = path.join(
    process.env.T3CODE_HOME || path.join(homedir(), ".t3"),
    "userdata/state.sqlite"
  );
  if (!fs.existsSync(file))
    throw new Error(`T3 state was not found at ${file}. No binding was made.`);
  const sqlite = process.getBuiltinModule?.("node:sqlite");
  if (!sqlite)
    throw new Error("T3 bindings require Node 22.5 or later for node:sqlite.");
  const database = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    for (const [table, required] of Object.entries(t3Columns)) {
      const columns = database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name);
      if (required.some((column) => !columns.includes(column)))
        throw new Error(
          `T3 state schema changed (${table}). No binding was made; update the t3 lookup.`
        );
    }
    const real = (value) => {
      try {
        return fs.realpathSync(value);
      } catch {
        return undefined;
      }
    };
    const matches = database
      .prepare(
        `SELECT t.thread_id AS threadId, t.branch AS branch, p.workspace_root AS workspaceRoot, t.worktree_path AS worktreePath
         FROM projection_threads t JOIN projection_projects p ON p.project_id = t.project_id
         WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL AND t.worktree_path IS NOT NULL`
      )
      .all()
      .filter((row) => real(row.worktreePath) === root);
    if (matches.length !== 1)
      throw new Error(
        matches.length
          ? "Several T3 threads record this worktree. Resolve it in T3; no binding was made."
          : "No live T3 thread records this worktree. No binding was made."
      );
    if (real(matches[0].workspaceRoot) !== primary)
      throw new Error(
        "The owning T3 thread belongs to a different project. No binding was made."
      );
    return { threadId: matches[0].threadId, branch: matches[0].branch };
  } finally {
    database.close();
  }
}

export function project(cwd = process.cwd()) {
  const current = fs.realpathSync(git(cwd, "rev-parse", "--show-toplevel"));
  const listing = git(current, "worktree", "list", "--porcelain", "-z");
  const first = listing
    .split("\0")
    .find((line) => line.startsWith("worktree "));
  if (!first) throw new Error("A primary Git checkout is required.");
  const primary = fs.realpathSync(first.slice(9));
  const common = fs.realpathSync(
    path.resolve(current, git(current, "rev-parse", "--git-common-dir"))
  );
  const cloudControl = path.join(current, "zlocal/agent-cloud-workspaces");
  const cloudFile = path.join(cloudControl, "assignment.json");
  let cloud = false;
  if (current === primary && fs.existsSync(cloudFile)) {
    const assignment = JSON.parse(fs.readFileSync(cloudFile));
    if (
      assignment.version !== 1 ||
      assignment.root !== current ||
      assignment.kind !== "cloud"
    )
      throw new Error(
        "Invalid retained cloud assignment; preserve it for inspection."
      );
    cloud = true;
  }
  return {
    current,
    primary,
    control: cloud ? cloudControl : path.join(common, "agent-worktrees"),
    cloud,
    legacyControl: path.join(primary, "zlocal/agent-worktrees"),
  };
}

function lock(context, action) {
  if (fs.existsSync(path.join(context.legacyControl, "operation.lock")))
    throw new Error(
      "A legacy worktree operation lock exists. Inspect it and use unlock for a confirmed dead owner before migration."
    );
  fs.mkdirSync(context.control, { recursive: true });
  const directory = path.join(context.control, "operation.lock");
  try {
    fs.mkdirSync(directory);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        `Another worktree operation holds ${directory}. Retry after it finishes; use unlock only for a confirmed dead owner.`,
        { cause: error }
      );
    throw error;
  }
  try {
    atomicJSON(path.join(directory, "owner.json"), {
      pid: process.pid,
      created: new Date().toISOString(),
    });
    return action();
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
}

function identity({ key, provider, threadId, newThread }) {
  if (key) {
    if (!/^(codex|claude|cursor|t3)-[a-f0-9]{12}$/.test(key))
      throw new Error("Invalid thread key.");
    return { key };
  }
  if (!providers.includes(provider))
    throw new Error("Choose --provider codex, claude, cursor, or t3.");
  const id =
    threadId ||
    (provider === "codex" ? process.env.CODEX_THREAD_ID : undefined) ||
    (newThread ? randomUUID() : undefined);
  if (!id || typeof id !== "string" || id.length > 256) {
    throw new Error(
      "A stable --thread-id is required. For a genuinely new thread without a host ID, use --new-thread once and retain its returned key."
    );
  }
  return {
    key: `${provider}-${createHash("sha256").update(`${provider}:${id}`).digest("hex").slice(0, 12)}`,
    provider,
    threadId: id,
  };
}
// A T3 thread ID comes from T3's state for the checkout, never from the caller alone.
function hostIdentity(context, options) {
  if (options.harness === "t3" && !options.key && options.provider !== "t3")
    throw new Error("Harness t3 requires --provider t3.");
  if (options.key || options.provider !== "t3") return options;
  if (options.harness && options.harness !== "t3")
    throw new Error("Provider t3 requires --harness t3.");
  const root = options.assignedRoot
    ? fs.realpathSync(options.assignedRoot)
    : context.current;
  const thread = t3Thread(context.primary, root);
  if (options.threadId && options.threadId !== thread.threadId)
    throw new Error(
      "The supplied thread ID does not match the T3 thread that owns this worktree."
    );
  return { ...options, harness: "t3", threadId: thread.threadId };
}
function filename(context, key) {
  return path.join(context.control, "threads", `${key}.json`);
}
function readState(context, id) {
  const file = filename(context, id.key);
  const legacy = path.join(context.legacyControl, "threads", `${id.key}.json`);
  const source = fs.existsSync(file) ? file : legacy;
  if (!fs.existsSync(source)) return undefined;
  const state = JSON.parse(fs.readFileSync(source, "utf8"));
  if (state.version === 1) {
    state.version = 2;
    state.owner = state.mode === "main" ? "primary" : "helper";
    state.workflow = state.mode === "main" ? "off" : "local";
    state.completion = "local";
    state.remoteChecks = false;
  }

  if (
    state.version !== 2 ||
    !["primary", "helper", "harness"].includes(state.owner) ||
    !["off", "local", "remote"].includes(state.workflow) ||
    !["local", "pr", "harness"].includes(state.completion) ||
    state.key !== id.key ||
    state.primary !== context.primary ||
    !["main", "worktree"].includes(state.mode)
  ) {
    throw new Error(`Invalid thread record: ${file}`);
  }
  if (
    id.threadId &&
    (id.provider !== state.provider || id.threadId !== state.threadId)
  )
    throw new Error("Thread identity does not match its retained binding.");
  if (state.mode === "main" && state.root !== context.primary)
    throw new Error("Invalid main workspace.");
  if (
    state.owner === "helper" &&
    (!state.root.startsWith(`${context.primary}/zlocal/worktrees/`) ||
      !state.branch.startsWith("agent/"))
  ) {
    throw new Error(
      "The worktree record points outside its managed directory or branch namespace."
    );
  }
  return state;
}
function save(context, state) {
  atomicJSON(filename(context, state.key), state);
}
function checkWorkspace(state) {
  if (!fs.existsSync(state.root))
    throw new Error(
      state.owner === "harness"
        ? "Harness worktree is missing. Obtain explicit host reassignment; it was not recreated or moved to main."
        : "Worktree is missing. Run ensure with the retained thread key to recreate it."
    );
  const context = project(state.root);
  const current = branch(state.root, state.owner === "harness");
  if (
    context.current !== fs.realpathSync(state.root) ||
    context.primary !== state.primary ||
    (current !== state.branch && state.harness !== "t3")
  ) {
    throw new Error(
      "Workspace ownership or branch changed. Stop before editing."
    );
  }
  if (current !== state.branch) {
    // T3 follows branch renames after each turn; accept only the branch it recorded.
    const thread = t3Thread(state.primary, context.current);
    if (thread.threadId !== state.threadId || thread.branch !== current)
      throw new Error(
        "Workspace branch changed and T3 has not recorded it for this thread. Stop before editing."
      );
    state.branch = current;
  }
  if (
    state.branch !== null &&
    git(state.root, "worktree", "list", "--porcelain", "-z")
      .split("\0")
      .filter((line) => line === `branch refs/heads/${state.branch}`).length > 1
  )
    throw new Error(
      "Workspace ownership conflict: this branch is checked out in another root. No branch was renamed."
    );
}
function helperCommand(context, command, key) {
  const helper = path.join(
    context.primary,
    "scripts/agents/worktrees/agent-worktrees.mjs"
  );
  const current = fileURLToPath(import.meta.url);
  const matching = ["agent-worktrees.mjs", "agent-worktree-policy.mjs"].every(
    (name) => {
      const installed = path.join(
        context.primary,
        "scripts/agents/worktrees",
        name
      );
      const source = path.join(path.dirname(current), name);
      return (
        fs.existsSync(installed) &&
        fs.readFileSync(installed, "utf8") === fs.readFileSync(source, "utf8")
      );
    }
  );
  const executable = matching ? helper : current;
  const quote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;
  return `node ${quote(executable)} ${command} --key ${key}`;
}
function result(context, state, extra = {}) {
  return {
    ...state,
    cleanupCommand:
      state.owner === "helper"
        ? helperCommand(context, "cleanup", state.key)
        : undefined,
    finishCommand: helperCommand(context, "finish", state.key),
    ...extra,
  };
}
function prepareLocal(context, state) {
  if (
    fs
      .lstatSync(path.join(state.root, "zlocal"), { throwIfNoEntry: false })
      ?.isSymbolicLink()
  )
    throw new Error("Shared zlocal symlinks are not supported.");
  // Own only worktree settings; depth can be absent or installed separately.
  migrateConfig(context.primary);
  fs.mkdirSync(path.join(state.root, "zlocal"), { recursive: true });
  for (const name of ["dev-config.json"]) {
    const source = path.join(context.primary, "zlocal", name);
    const target = path.join(state.root, "zlocal", name);
    if (!fs.existsSync(source)) continue;
    if (fs.existsSync(target)) {
      if (
        state.owner !== "harness" &&
        fs.realpathSync(target) !== fs.realpathSync(source)
      )
        throw new Error(`Refusing to replace local settings: ${target}`);
    } else {
      fs.symlinkSync(source, target);
    }
  }
  for (const name of environmentFiles) {
    const source = path.join(context.primary, name);
    const target = path.join(state.root, name);
    if (fs.existsSync(source) && !fs.existsSync(target)) {
      if (!fs.lstatSync(source).isFile())
        throw new Error(`Environment file must be a regular file: ${source}`);
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(target, 0o600);
    }
  }
  if (state.key)
    atomicJSON(path.join(state.root, "zlocal/agent-worktree.json"), {
      key: state.key,
      primary: context.primary,
    });
}

function syncState(context, state) {
  if (state.mode === "main") return result(context, state, { sync: "main" });
  checkWorkspace(state);
  if (state.owner === "harness" || state.workflow === "remote")
    return result(context, state, { sync: "owner_managed" });
  if (dirty(state.root))
    return result(context, state, { sync: "skipped_dirty" });
  const before = sha(state.root);
  const main = sha(context.primary);
  if (ancestor(state.root, main, before))
    return result(context, state, { sync: "current" });
  try {
    git(state.root, "merge", "--no-edit", "main");
  } catch (error) {
    // Abort only the merge this call just started. Existing edits were ruled out.
    const mergeHead = git(state.root, "rev-parse", "--git-path", "MERGE_HEAD");
    if (fs.existsSync(path.resolve(state.root, mergeHead)))
      git(state.root, "merge", "--abort");
    throw new Error(
      `Sync failed; main is unchanged and the worktree was restored: ${error.message}`,
      { cause: error }
    );
  }
  state.lastSync = sha(state.root);
  save(context, state);
  return result(context, state, {
    sync: before === state.lastSync ? "current" : "updated",
  });
}

export function ensure(input = {}) {
  const context = project(input.cwd);
  if (input.provider === "t3" && !input.key && !input.assignedRoot)
    throw new Error(
      "A T3 binding must name its current worktree with --assigned-root."
    );
  const options = hostIdentity(context, input);
  const id = identity(options);
  if (options.assignmentKind === "cloud") {
    if (
      !options.assignedRoot ||
      fs.realpathSync(options.assignedRoot) !== context.current ||
      context.current !== context.primary ||
      !cloudHarnesses.includes(options.harness)
    )
      throw new Error(
        "Cloud binding needs an explicit host-assigned ordinary clone."
      );
    const prior = readState(context, id);
    if (prior && prior.assignmentKind !== "cloud")
      throw new Error(
        "Cloud assignment conflicts with this thread's retained local workspace."
      );
    context.control = path.join(
      context.current,
      "zlocal/agent-cloud-workspaces"
    );
    context.cloud = true;
  }
  const config = readConfig(context.primary);
  return lock(context, () => {
    if (context.cloud)
      atomicJSON(path.join(context.control, "assignment.json"), {
        version: 1,
        root: context.current,
        kind: "cloud",
      });
    let state = readState(context, id);
    const requested =
      options.mode === "main"
        ? "off"
        : options.mode === "worktree"
          ? "local"
          : options.mode;
    if (state && requested && requested !== state.workflow)
      throw new Error(
        "This thread's mode is fixed. Start a new thread for a different mode."
      );
    if (
      state &&
      options.assignedRoot &&
      fs.realpathSync(options.assignedRoot) !== state.root
    )
      throw new Error(
        "Host assignment changed. Review explicit reassignment; no workspace was moved."
      );
    if (
      state &&
      options.assignmentKind &&
      options.assignmentKind !== (state.assignmentKind ?? "linked")
    )
      throw new Error(
        "Host assignment kind changed. Review explicit reassignment before continuing."
      );
    let checked;
    if (!state) {
      if (!id.provider)
        throw new Error(
          "Unknown thread key. Recover its record rather than creating a different workspace."
        );
      const workflow = requested ?? config.WORKTREES_MODE;
      if (!["off", "local", "remote"].includes(workflow))
        throw new Error("Mode must be off, local, or remote.");
      const slug = options.slug ?? "thread";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64)
        throw new Error(
          "Slug must be lowercase words separated by hyphens, at most 64 characters."
        );
      const assigned = options.assignedRoot
        ? fs.realpathSync(options.assignedRoot)
        : undefined;
      if (
        options.assignmentKind &&
        !["linked", "cloud"].includes(options.assignmentKind)
      )
        throw new Error("Assignment kind must be linked or cloud.");
      if (options.assignmentKind === "cloud" && !assigned)
        throw new Error(
          "A cloud assignment must explicitly identify its current checkout."
        );
      if (
        assigned &&
        (!providers.includes(options.harness) ||
          assigned !== context.current ||
          (assigned === context.primary &&
            options.assignmentKind !== "cloud") ||
          (options.assignmentKind === "cloud" &&
            assigned !== context.primary) ||
          project(assigned).primary !== context.primary)
      )
        throw new Error(
          "A harness assignment must explicitly identify the current linked checkout or a cloud-owned ordinary clone."
        );
      if (!assigned && !options.adopt && context.current !== context.primary)
        throw new Error(
          "An unassigned linked checkout cannot silently claim another thread's workspace. Supply an explicit harness assignment or adopt your assigned helper worktree."
        );
      const name = `${slug}-${id.key}`;
      const effective = assigned ? "local" : workflow;
      if (!assigned && branch(context.primary) !== "main")
        throw new Error(
          "Helper routing requires the primary checkout on main. No branch was switched."
        );
      if (effective === "remote") {
        checked = remotePreflight(context.primary, config);
        if (checked.requiresApproval && options.approval !== checked.approval)
          return {
            creation: "approval_required",
            commits: checked.commits,
            files: checked.files,
            remoteCommit: checked.remoteCommit,
            approval: checked.approval,
            baselineCommitWillBeCreated: checked.files.length > 0,
            message:
              "Review local work before creation. Confirm carrying it, or push and rerun to verify. No binding, branch, or worktree was created.",
          };
      }
      state = {
        version: 2,
        ...id,
        primary: context.primary,
        owner: assigned
          ? "harness"
          : effective === "off"
            ? "primary"
            : "helper",
        mode: assigned || effective !== "off" ? "worktree" : "main",
        workflow: assigned ? "local" : workflow,
        completion: assigned
          ? "harness"
          : workflow === "remote"
            ? "pr"
            : "local",
        root:
          assigned ??
          (effective === "off"
            ? context.primary
            : path.join(context.primary, "zlocal/worktrees", name)),
        branch: assigned
          ? branch(assigned, true)
          : effective === "off"
            ? "main"
            : `agent/${name}`,
        baseCommit: assigned
          ? sha(assigned)
          : (checked?.remoteCommit ?? sha(context.primary)),
        remote: config.WORKTREES_REMOTE,
        remoteBranch: config.WORKTREES_REMOTE_BRANCH,
        remoteChecks: options.remoteChecks ?? config.REMOTE_CHECKS,
        excludedMainChanges: effective === "local" && dirty(context.primary),
        baseline: assigned
          ? baseline(assigned)
          : effective === "off"
            ? baseline(context.primary)
            : undefined,
        harness: assigned ? options.harness : undefined,
        assignmentKind: assigned
          ? (options.assignmentKind ?? "linked")
          : undefined,
        created: new Date().toISOString(),
        cleaned: false,
      };
      if (options.adopt) {
        if (
          assigned ||
          state.mode !== "worktree" ||
          !context.current.startsWith(`${context.primary}/zlocal/worktrees/`) ||
          !branch(context.current).startsWith("agent/") ||
          dirty(context.current)
        )
          throw new Error(
            "Adoption requires an explicitly assigned, clean agent worktree under the primary zlocal/worktrees directory."
          );
        if (!ancestor(context.current, state.baseCommit, "HEAD"))
          throw new Error(
            "Adopted worktree does not contain the selected main commit."
          );
        state.root = context.current;
        state.branch = branch(context.current);
      }
      if (
        records(context).some(
          (other) =>
            other.key !== state.key &&
            !other.cleaned &&
            other.root === state.root &&
            other.owner !== "primary"
        )
      )
        throw new Error("This worktree is already owned by another thread.");
      if (state.owner !== "harness") migrateConfig(context.primary);
      if (state.owner === "primary") claim(context, state);
      save(context, state);
    }
    if (state.owner === "helper" && !fs.existsSync(state.root)) {
      const existing = spawnSync(
        "git",
        ["show-ref", "--verify", "--quiet", `refs/heads/${state.branch}`],
        { cwd: context.primary }
      );
      fs.mkdirSync(path.dirname(state.root), { recursive: true });
      if (existing.status === 0) {
        if (!state.cleaned)
          throw new Error(
            "Retained branch has unapplied commits or a missing checkout. Recover it before recreation."
          );
        git(context.primary, "worktree", "add", state.root, state.branch);
      } else if (existing.status === 1) {
        if (state.workflow === "remote" && !checked) {
          checked = remotePreflight(context.primary, {
            ...config,
            WORKTREES_REMOTE: state.remote,
            WORKTREES_REMOTE_BRANCH: state.remoteBranch,
          });
          if (checked.requiresApproval && options.approval !== checked.approval)
            return result(context, state, {
              creation: "approval_required",
              commits: checked.commits,
              files: checked.files,
              approval: checked.approval,
            });
          state.baseCommit = checked.remoteCommit;
        } else if (state.workflow === "local")
          state.baseCommit = sha(context.primary);
        git(
          context.primary,
          "worktree",
          "add",
          "-b",
          state.branch,
          state.root,
          state.baseCommit
        );
      } else throw new Error("Cannot inspect the worktree branch.");
      state.cleaned = false;
      save(context, state);
      if (checked?.requiresApproval) {
        try {
          carryLocal(state.root, context.primary, checked, {
            beforeCommit: () => {
              prepareLocal(context, state);
              if (fs.existsSync(path.join(state.root, "pnpm-lock.yaml")))
                installDependencies(state.root);
              return taskEnvironment(state.root, toolchain(state.root));
            },
          });
          state.carriedLocal = {
            approval: checked.approval,
            commits: checked.commits,
            files: checked.files,
            head: sha(state.root),
          };
          save(context, state);
        } catch (error) {
          state.setupFailure = error.message;
          save(context, state);
          throw new Error(
            `Local carry failed; retained ${state.root}: ${error.message}`,
            { cause: error }
          );
        }
      }
    }
    checkWorkspace(state);
    if (state.setupFailure)
      throw new Error(
        `Inspect and resolve retained setup failure: ${state.setupFailure}`
      );
    if (state.owner !== "primary") prepareLocal(context, state);
    claim(context, state);
    save(context, state);
    return syncState(context, state);
  });
}

function records(context) {
  const names = new Set();
  for (const base of [context.control, context.legacyControl]) {
    const directory = path.join(base, "threads");
    if (fs.existsSync(directory))
      for (const name of fs.readdirSync(directory))
        if (name.endsWith(".json")) names.add(name.slice(0, -5));
  }
  return [...names].map((key) => readState(context, { key }));
}
function claim(context, state) {
  if (state.owner === "primary") {
    const file = path.join(context.control, "main-writer.json");
    const owner = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : undefined;
    if (owner && owner.key !== state.key)
      throw new Error(
        `Main writer belongs to ${owner.key}. Stay read-only until finish or inspected recovery. Age and helper PID do not release it.`
      );
    atomicJSON(file, {
      key: state.key,
      started: owner?.started ?? new Date().toISOString(),
    });
  }
  state.active = true;
}
function release(context, state) {
  const file = path.join(context.control, "main-writer.json");
  if (
    fs.existsSync(file) &&
    JSON.parse(fs.readFileSync(file, "utf8")).key === state.key
  )
    fs.unlinkSync(file);
  state.active = false;
  save(context, state);
}
export function finish(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    release(context, state);
    return result(context, state, { released: true });
  });
}
export function recover(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const file = path.join(context.control, "main-writer.json");
    const owner = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : undefined;
    const reviewed = baseline(context.primary);
    const token = createHash("sha256")
      .update(JSON.stringify({ owner, reviewed }))
      .digest("hex");
    if (!options.approval)
      return {
        owner,
        reviewed,
        recoveryToken: token,
        message:
          "Inspect checkout and obtain explicit recovery authorization before --approval.",
      };
    if (options.approval !== token)
      throw new Error(
        "Checkout or writer changed after inspection. Review recovery again."
      );
    if (owner) {
      const state = readState(context, { key: owner.key });
      if (state) {
        state.active = false;
        save(context, state);
      }
      fs.unlinkSync(file);
    }
    return { recovered: true };
  });
}
export function preflight(options = {}) {
  const context = project(options.cwd);
  const state = required(context, options);
  checkWorkspace(state);
  const files = options.scope ?? changedFiles(state.root);
  if (
    !Array.isArray(files) ||
    files.some(
      (file) =>
        typeof file !== "string" ||
        !file ||
        path.isAbsolute(file) ||
        file.split(/[\\/]/).includes("..")
    )
  )
    throw new Error("Scope must contain repository-relative file paths.");
  const conflicts = [];
  for (const other of records(context)) {
    if (
      other.key === state.key ||
      !other.active ||
      other.cleaned ||
      !fs.existsSync(other.root)
    )
      continue;
    const committed = policyGit(
      other.root,
      "diff",
      "--name-only",
      "-z",
      `${other.baseCommit}...HEAD`
    )
      .split("\0")
      .filter(Boolean);
    const changed = [
      ...new Set([
        ...(other.scope ?? []),
        ...changedFiles(other.root),
        ...committed,
      ]),
    ];
    const overlap = files.filter((file) => changed.includes(file));
    if (overlap.length)
      conflicts.push({ key: other.key, files: overlap, severity: "review" });
  }
  let remoteInspection = "disabled";
  if (state.remoteChecks) {
    try {
      policyGit(state.root, "fetch", "--no-tags", state.remote);
      const prs = JSON.parse(
        policyRun(state.root, [
          "gh",
          "pr",
          "list",
          "--repo",
          remoteRepository(state.root, state.remote),
          "--state",
          "open",
          "--json",
          "number,url,files",
          "--limit",
          "100",
        ])
      );
      for (const pr of prs) {
        const overlap = files.filter((file) =>
          pr.files.some((changed) => changed.path === file)
        );
        if (overlap.length)
          conflicts.push({ pr: pr.url, files: overlap, severity: "review" });
      }
      remoteInspection =
        prs.length === 100
          ? "partial: first 100 open PRs inspected"
          : "checked";
    } catch (error) {
      remoteInspection = `not_verified: ${error.message}`;
    }
  }
  return result(context, state, {
    scope: files,
    overlaps: conflicts,
    remoteInspection,
    message:
      "Overlap is advisory. Checkout ownership conflicts and known incompatible changes stop work.",
  });
}
export function scope(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    const report = preflight(options);
    claim(context, state);
    state.scope = report.scope;
    save(context, state);
    return result(context, state, {
      overlaps: report.overlaps,
      remoteInspection: report.remoteInspection,
    });
  });
}

function required(context, options) {
  const state = readState(context, identity(hostIdentity(context, options)));
  if (!state)
    throw new Error(
      "This thread has no workspace binding. Run ensure before editing."
    );
  return state;
}
export function status(options = {}) {
  const context = project(options.cwd);
  const state = required(context, options);
  if (state.cleaned || !fs.existsSync(state.root))
    return result(context, state, { status: "cleaned_or_missing" });
  checkWorkspace(state);
  const head = sha(state.root);
  return result(context, state, {
    status: state.active ? "active" : "released",
    head,
    dirty: dirty(state.root),
    pending:
      state.owner === "harness" && state.harness !== "t3"
        ? head !== state.baseline?.head
        : state.completion === "pr"
          ? head !== state.baseCommit
          : state.mode === "worktree" &&
            !ancestor(context.primary, head, "main"),
    inheritedInterim:
      ((state.mode === "worktree" && ancestor(context.primary, head, "main")) ||
        state.baseline?.head === head) &&
      git(state.root, "log", "-1", "--format=%s") === "interim commit",
  });
}
export function list(options = {}) {
  const context = project(options.cwd);
  return records(context).map((state) =>
    status({ cwd: context.primary, key: state.key })
  );
}
export function sync(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => syncState(context, required(context, options)));
}

function installDependencies(root) {
  const modules = path.join(root, "node_modules");
  if (fs.lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error("Shared node_modules symlinks are not supported.");
  const packageFile = path.join(root, "package.json");
  if (!fs.existsSync(packageFile)) return { dependencies: "not_needed" };
  const lockFile = path.join(root, "pnpm-lock.yaml");
  if (!fs.existsSync(lockFile))
    throw new Error("Automatic dependency setup requires pnpm-lock.yaml.");
  const runtime = toolchain(root);
  const fingerprint = createHash("sha256")
    .update(fs.readFileSync(packageFile))
    .update(fs.readFileSync(lockFile))
    .update(`${runtime.nodeVersion}:${runtime.managerVersion}`)
    .digest("hex");
  const stamp = path.join(root, "zlocal/.worktree-dependencies");
  if (
    fs.existsSync(modules) &&
    fs.existsSync(stamp) &&
    fs.readFileSync(stamp, "utf8") === fingerprint
  )
    return { dependencies: "current" };
  process.stderr.write(`Installing separate dependencies in ${root}\n`);
  policyRun(
    root,
    [...managerCommand(runtime), "install", "--frozen-lockfile"],
    {
      env: taskEnvironment(root, runtime),
      stdio: ["ignore", 2, 2],
      timeout: 300000,
    }
  );
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, fingerprint);
  return {
    dependencies: "installed",
    runtime: runtime.runtime,
    node: runtime.node,
    nodeVersion: runtime.nodeVersion,
    managerVersion: runtime.managerVersion,
  };
}
export function deps(options = {}) {
  const context = project(options.cwd);
  const state = required(context, options);
  checkWorkspace(state);
  if (state.mode === "main") {
    const runtime = toolchain(state.root);
    return result(context, state, {
      dependencies: "primary_unchanged",
      runtime: runtime.runtime,
      nodeVersion: runtime.nodeVersion,
      managerVersion: runtime.managerVersion,
    });
  }
  return lock(context, () =>
    result(context, state, installDependencies(state.root))
  );
}

// Combined-change defaults: full typecheck, then ESLint on files either side changed.
export function defaultChecks(root, base) {
  const checks = [];
  if (fs.existsSync(path.join(root, "tsconfig.json")))
    checks.push(["pnpm", "exec", "tsc", "--noEmit", "--skipLibCheck"]);
  const lintable = git(
    root,
    "diff",
    "--name-only",
    "--diff-filter=d",
    "-z",
    base,
    "HEAD"
  )
    .split("\0")
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file));
  if (
    lintable.length &&
    fs
      .readdirSync(root)
      .some((name) => /^eslint\.config\.[cm]?[jt]s$/.test(name))
  )
    checks.push(["pnpm", "exec", "eslint", "--no-warn-ignored", ...lintable]);
  return checks;
}
export function integrate(options = {}) {
  const context = project(options.cwd);
  return lock(context, () =>
    integrateState(context, required(context, options), options)
  );
}
function integrateState(context, state, options) {
  checkWorkspace(state);
  if (state.mode === "main")
    return result(context, state, { integration: "main" });
  if (
    (state.owner === "harness" || state.completion === "pr") &&
    !options.explicitIntegration
  )
    return result(context, state, {
      integration: "pending",
      reason: state.owner === "harness" ? "harness_handoff" : "pr_completion",
    });
  // T3 runs each thread inside its worktree; its sandbox approval gates the primary write.
  if (
    state.owner === "harness" &&
    state.harness !== "t3" &&
    context.current !== context.primary
  )
    return result(context, state, {
      integration: "pending",
      reason: "run_from_permitted_primary_session",
    });
  if (branch(context.primary) !== "main")
    throw new Error("Local integration requires primary main.");
  const writer = path.join(context.control, "main-writer.json");
  if (
    fs.existsSync(writer) &&
    JSON.parse(fs.readFileSync(writer, "utf8")).key !== state.key
  )
    return result(context, state, {
      integration: "pending",
      reason: "main_writer_active",
    });
  if (dirty(state.root))
    throw new Error(
      "Commit or resolve the worktree's changes before integration."
    );
  const head = sha(state.root);
  if (
    git(state.root, "log", "--format=%s", `main..${head}`)
      .split("\n")
      .includes("interim commit")
  )
    throw new Error("Finalize interim commits before integration.");
  const pending = (reason, extra = {}) =>
    result(context, state, { integration: "pending", reason, ...extra });
  if (dirty(context.primary)) return pending("main_dirty");
  if (git(context.primary, "log", "-1", "--format=%s") === "interim commit")
    return pending("main_interim_commit");
  if (ancestor(context.primary, head, "main")) {
    state.lastIntegratedCommit = head;
    save(context, state);
    syncState(context, state);
    return result(context, state, { integration: "already_integrated" });
  }
  const checks = options.checks ?? [];
  if (
    !Array.isArray(checks) ||
    checks.some(
      (command) =>
        !Array.isArray(command) ||
        !command.length ||
        command.some((argument) => typeof argument !== "string" || !argument)
    )
  )
    throw new Error(
      "Checks must be arrays of executable and argument strings."
    );
  const main = sha(context.primary);
  const diverged = !ancestor(context.primary, main, head);
  if (diverged && checks.length === 0 && !options.defaultChecks)
    return pending("combined_checks_required");
  const candidate = path.join(
    context.primary,
    "zlocal/worktrees",
    `.integration-${state.key}-${randomUUID()}`
  );
  git(context.primary, "worktree", "add", "--detach", candidate, main);
  const receipts = [];
  let preserve = false;
  try {
    prepareLocal(context, { ...state, root: candidate });
    try {
      git(candidate, "merge", "--no-edit", head);
    } catch (error) {
      const mergeHead = git(candidate, "rev-parse", "--git-path", "MERGE_HEAD");
      if (fs.existsSync(path.resolve(candidate, mergeHead)))
        git(candidate, "merge", "--abort");
      return pending("merge_failed", { detail: error.message });
    }
    const planned =
      diverged && options.defaultChecks
        ? [
            ...defaultChecks(
              candidate,
              git(candidate, "merge-base", main, head)
            ),
            ...checks,
          ]
        : checks;
    if (diverged && planned.length === 0)
      return pending("combined_checks_required");
    if (
      planned.some((command) =>
        ["pnpm", "npm", "npx"].includes(path.basename(command[0]))
      )
    )
      installDependencies(candidate);
    for (const command of planned) {
      const started = Date.now();
      try {
        executeTask(candidate, command);
        receipts.push({
          command,
          exitCode: 0,
          milliseconds: Date.now() - started,
        });
      } catch (error) {
        receipts.push({
          command,
          exitCode: error.exitCode ?? 1,
          milliseconds: Date.now() - started,
        });
        preserve = dirty(candidate);
        return pending("check_failed", {
          checks: receipts,
          detail: error.message,
          candidate: preserve ? candidate : undefined,
        });
      }
    }
    if (dirty(candidate)) {
      preserve = true;
      return pending("checks_changed_checkout", {
        candidate,
        checks: receipts,
      });
    }
    if (sha(context.primary) !== main || dirty(context.primary))
      return pending("main_changed_during_checks", { checks: receipts });
    if (sha(state.root) !== head || dirty(state.root))
      return pending("worktree_changed_during_checks", { checks: receipts });
    const integrated = sha(candidate);
    git(context.primary, "merge", "--ff-only", integrated);
    state.lastIntegratedCommit = head;
    state.lastMainCommit = integrated;
    save(context, state);
    // Only advance this thread's clean branch. A later main edit is never reset.
    git(state.root, "merge", "--ff-only", integrated);
    return result(context, state, {
      integration: "integrated",
      commit: integrated,
      checks: receipts,
    });
  } finally {
    if (!preserve && !dirty(candidate))
      git(context.primary, "worktree", "remove", candidate);
    else {
      state.retainedCandidate = candidate;
      save(context, state);
    }
  }
}

function archiveLocal(context, state) {
  const ignored = git(
    state.root,
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--directory",
    "-z"
  )
    .split("\0")
    .filter(Boolean)
    .flatMap((name) =>
      name.endsWith("/") &&
      generatedDirectories.some(
        (directory) => directory !== name && directory.startsWith(name)
      )
        ? git(
            state.root,
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "-z",
            "--",
            name
          )
            .split("\0")
            .filter(Boolean)
        : [name]
    );
  const unknown = ignored.filter(
    (name) =>
      !name.startsWith("zlocal/") &&
      !environmentFiles.includes(name) &&
      !generatedDirectories.some(
        (directory) => name === directory || name.startsWith(directory)
      ) &&
      !name.endsWith(".tsbuildinfo") &&
      !["next-env.d.ts", ".DS_Store"].includes(name)
  );
  if (unknown.length)
    throw new Error(
      `Ignored files need preservation before cleanup: ${unknown.join(", ")}`
    );
  const destination = path.join(
    context.primary,
    "zlocal/artifacts/worktree-cleanup",
    state.key,
    randomUUID()
  );
  fs.mkdirSync(destination, { recursive: true });
  const local = path.join(state.root, "zlocal");
  if (fs.existsSync(local))
    fs.cpSync(local, path.join(destination, "zlocal"), {
      recursive: true,
      dereference: false,
    });
  for (const name of environmentFiles) {
    if (fs.existsSync(path.join(state.root, name)))
      fs.copyFileSync(
        path.join(state.root, name),
        path.join(destination, name)
      );
  }
  return destination;
}
export function cleanup(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => cleanupState(context, required(context, options)));
}
function cleanupState(context, state) {
  // T3 leaves merged worktrees and branches behind, so its bindings clean up here.
  if (state.owner === "harness" && state.harness !== "t3")
    return result(context, state, {
      cleanup: "harness_managed",
      message: "Use the host cleanup workflow. Nothing was removed.",
    });
  if (state.mode !== "worktree")
    throw new Error(
      "This thread runs on main and has no worktree to clean up."
    );
  if (state.cleaned && !fs.existsSync(state.root))
    return result(context, state, { cleanup: "already_cleaned" });
  checkWorkspace(state);
  if (state.retainedCandidate && fs.existsSync(state.retainedCandidate))
    throw new Error(
      `Inspect the retained integration checkout before cleanup: ${state.retainedCandidate}`
    );
  if (
    git(state.root, "worktree", "list", "--porcelain", "-z")
      .split("\0")
      .some(
        (line) =>
          line.startsWith(`worktree ${state.root}/`) &&
          fs.existsSync(line.slice(9))
      )
  )
    throw new Error(
      "Cleanup refused: a nested registered checkout must be handled by its owner first."
    );
  if (dirty(state.root))
    throw new Error("Cleanup refused: the worktree has uncommitted work.");
  const head = sha(state.root);
  let prVerified = false;
  if (state.completion === "pr") {
    if (!state.pr)
      throw new Error(
        "Cleanup refused: record the corresponding PR with pr-record."
      );
    const pr = pullRequest(state.root, state.pr.number, state.remote);
    if (
      pr.state !== "MERGED" ||
      pr.headRefOid !== state.pr.head ||
      head !== state.pr.head ||
      pr.headRefName !== state.branch ||
      pr.baseRefName !== state.remoteBranch ||
      !pr.mergeCommit?.oid
    )
      throw new Error(
        "Cleanup refused: PR is unmerged, mismatched, or additional local work exists."
      );
    const checked = remotePreflight(context.primary, {
      ...readConfig(context.primary),
      WORKTREES_REMOTE: state.remote,
      WORKTREES_REMOTE_BRANCH: state.remoteBranch,
    });
    if (!ancestor(context.primary, pr.mergeCommit.oid, checked.remoteCommit))
      throw new Error(
        "Cleanup refused: merged PR commit is not on fetched target."
      );
    prVerified = true;
  } else if (!ancestor(context.primary, head, "main"))
    throw new Error("Cleanup refused: the worktree has unapplied work.");
  assertNoProjectServers(state.root);
  const archive = archiveLocal(context, state);
  git(context.primary, "worktree", "remove", state.root);
  if (state.branch)
    git(context.primary, "branch", prVerified ? "-D" : "-d", state.branch);
  state.cleaned = true;
  state.active = false;
  state.archive = archive;
  save(context, state);
  return result(context, state, { cleanup: "cleaned" });
}
// Commit-to-cleanup completion for helper-local and T3 worktrees, under one lock.
export function merge(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    if (
      state.mode !== "worktree" ||
      state.completion === "pr" ||
      (state.owner === "harness" && state.harness !== "t3")
    )
      throw new Error(
        "merge supports helper-local and T3 worktrees only. Nothing was merged or removed."
      );
    const integration = integrateState(context, state, {
      checks: options.checks,
      explicitIntegration: true,
      defaultChecks: true,
    });
    if (!["integrated", "already_integrated"].includes(integration.integration))
      return { ...integration, merge: "pending" };
    const merged = {
      integration: integration.integration,
      commit: sha(context.primary),
      checks: integration.checks ?? [],
    };
    try {
      cleanupState(context, state);
    } catch (error) {
      return result(context, state, {
        ...merged,
        merge: "cleanup_pending",
        detail: error.message,
      });
    }
    release(context, state);
    return result(context, state, {
      ...merged,
      merge: "merged",
      cleanup: "cleaned",
      released: true,
    });
  });
}
export function prRecord(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    checkWorkspace(state);
    if (state.completion !== "pr" || !options.pr)
      throw new Error("pr-record requires a PR-mode binding and --pr.");
    const pr = pullRequest(state.root, options.pr, state.remote);
    if (
      pr.headRefName !== state.branch ||
      pr.headRefOid !== sha(state.root) ||
      pr.baseRefName !== state.remoteBranch
    )
      throw new Error("PR does not match saved branch, head, and target.");
    state.pr = { number: pr.number, url: pr.url, head: pr.headRefOid };
    save(context, state);
    return result(context, state, { pr: state.pr });
  });
}
export function runCommand(options = {}) {
  const context = project(options.cwd);
  const state = required(context, options);
  checkWorkspace(state);
  if (state.owner === "primary") {
    const file = path.join(context.control, "main-writer.json");
    if (
      !fs.existsSync(file) ||
      JSON.parse(fs.readFileSync(file, "utf8")).key !== state.key
    )
      throw new Error(
        "This thread does not hold the main writer claim. Run ensure before task commands."
      );
  }
  if (
    !Array.isArray(options.command) ||
    !options.command.length ||
    options.command.some((value) => typeof value !== "string" || !value)
  )
    throw new Error(
      "run requires --command as a nonempty JSON argument array."
    );
  const runtime = executeTask(state.root, options.command);
  return result(context, state, {
    exitCode: 0,
    nodeVersion: runtime.nodeVersion,
    managerVersion: runtime.managerVersion,
  });
}

function managerCommand(runtime) {
  return runtime.manager.endsWith(".cjs")
    ? [runtime.node, runtime.manager]
    : [runtime.manager];
}
function executeTask(root, command) {
  const runtime = toolchain(root);
  const args =
    command[0] === "node"
      ? [runtime.node, ...command.slice(1)]
      : command[0] === "pnpm"
        ? [...managerCommand(runtime), ...command.slice(1)]
        : command;
  policyRun(root, args, {
    env: taskEnvironment(root, runtime),
    stdio: ["ignore", 2, 2],
    timeout: 300000,
  });
  return runtime;
}
export function setup(options = {}) {
  const context = project(options.cwd);
  if (
    !providers.includes(options.harness) ||
    context.current === context.primary
  )
    throw new Error(
      "Setup requires the current native linked checkout and an explicit harness."
    );
  prepareLocal(context, { root: context.current, owner: "harness" });
  return {
    setup: "prepared",
    root: context.current,
    binding: "not_created",
    ...(options.skipDeps ? {} : installDependencies(context.current)),
  };
}
export function commitCheck(options = {}) {
  const context = project(options.cwd);
  const state = required(context, options);
  checkWorkspace(state);
  const files = changedFiles(state.root);
  const protectedFiles = files.filter((file) =>
    state.baseline?.files.includes(file)
  );
  return result(context, state, {
    protectedFiles,
    taskFiles: files.filter((file) => !protectedFiles.includes(file)),
    safeToStageAll: protectedFiles.length === 0,
    baselineHead: state.baseline?.head,
    message: protectedFiles.length
      ? "Do not stage these inherited dirty files automatically. Obtain file-specific instructions if task edits overlap them."
      : "Review task files before staging.",
  });
}
export function resolveSetup(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    checkWorkspace(state);
    if (!state.setupFailure)
      return result(context, state, { setup: "current" });
    const reviewed = baseline(state.root);
    const token = createHash("sha256")
      .update(JSON.stringify({ failure: state.setupFailure, reviewed }))
      .digest("hex");
    if (!options.approval)
      return result(context, state, {
        reviewed,
        recoveryToken: token,
        message:
          "Inspect and resolve the retained merge/carry failure before explicit recovery. Nothing was removed.",
      });
    if (options.approval !== token || dirty(state.root))
      throw new Error(
        "Setup recovery requires a reviewed, clean checkout and current approval token."
      );
    state.resolvedSetupFailure = state.setupFailure;
    delete state.setupFailure;
    save(context, state);
    return result(context, state, { setup: "resolved" });
  });
}
export function reassign(options = {}) {
  const context = project(options.cwd);
  return lock(context, () => {
    const state = required(context, options);
    if (
      state.owner !== "harness" ||
      !options.assignedRoot ||
      options.harness !== state.harness
    )
      throw new Error(
        "Reassignment requires an existing harness binding and explicit same-host assignment."
      );
    const root = fs.realpathSync(options.assignedRoot);
    if (
      root !== context.current ||
      root === context.primary ||
      project(root).primary !== context.primary
    )
      throw new Error(
        "Reassignment must name the current linked checkout in this repository."
      );
    if (
      records(context).some(
        (other) =>
          other.key !== state.key && !other.cleaned && other.root === root
      )
    )
      throw new Error("Assigned checkout belongs to another thread.");
    const reviewed = baseline(root);
    const token = createHash("sha256")
      .update(JSON.stringify({ previousRoot: state.root, root, reviewed }))
      .digest("hex");
    if (!options.approval)
      return result(context, state, {
        assignedRoot: root,
        reviewed,
        recoveryToken: token,
        message:
          "Inspect host reassignment and obtain explicit authorization. The old checkout will be preserved.",
      });
    if (options.approval !== token)
      throw new Error("Reassignment changed after inspection.");
    state.previousAssignments = [
      ...(state.previousAssignments ?? []),
      { root: state.root, branch: state.branch, baseline: state.baseline },
    ];
    state.root = root;
    state.branch = branch(root, true);
    state.baseline = reviewed;
    state.cleaned = false;
    claim(context, state);
    save(context, state);
    return result(context, state, { reassigned: true });
  });
}

export function unlock(options = {}) {
  const context = project(options.cwd);
  const directory = fs.existsSync(path.join(context.control, "operation.lock"))
    ? path.join(context.control, "operation.lock")
    : path.join(context.legacyControl, "operation.lock");
  const owner = JSON.parse(
    fs.readFileSync(path.join(directory, "owner.json"), "utf8")
  );
  if (!Number.isInteger(owner.pid) || owner.pid <= 0)
    throw new Error("Lock owner is invalid. Inspect it before recovery.");
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") {
      fs.rmSync(directory, { recursive: true });
      return { unlocked: true };
    }
    throw new Error(
      "Cannot prove the lock owner exited. The lock was preserved.",
      { cause: error }
    );
  }
  throw new Error("Lock owner is still running. The lock was preserved.");
}

function argumentsFrom(argv) {
  const [command, ...args] = argv;
  const options = { checks: [] };
  const values = {
    "--provider": "provider",
    "--thread-id": "threadId",
    "--key": "key",
    "--mode": "mode",
    "--slug": "slug",
    "--cwd": "cwd",
    "--assigned-root": "assignedRoot",
    "--assignment-kind": "assignmentKind",
    "--harness": "harness",
    "--approval": "approval",
    "--pr": "pr",
  };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--new-thread") options.newThread = true;
    else if (name === "--adopt") options.adopt = true;
    else if (name === "--skip-deps") options.skipDeps = true;
    else if (name === "--explicit-integration")
      options.explicitIntegration = true;
    else if (name === "--remote-checks") options.remoteChecks = true;
    else if (name === "--no-remote-checks") options.remoteChecks = false;
    else if (name === "--scope") options.scope = JSON.parse(args[++index]);
    else if (name === "--command") options.command = JSON.parse(args[++index]);
    else if (name === "--check") options.checks.push(JSON.parse(args[++index]));
    else if (values[name] && args[index + 1])
      options[values[name]] = args[++index];
    else throw new Error(`Unknown or incomplete option: ${name}`);
  }
  return { command, options };
}
if (
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { command, options } = argumentsFrom(process.argv.slice(2));
    const commands = {
      ensure,
      status,
      list,
      sync,
      deps,
      integrate,
      cleanup,
      merge,
      unlock,
      finish,
      recover,
      preflight,
      scope,
      "pr-record": prRecord,
      run: runCommand,
      setup,
      "commit-check": commitCheck,
      "resolve-setup": resolveSetup,
      reassign,
    };
    if (!commands[command])
      throw new Error(
        "Choose ensure, status, list, sync, deps, integrate, cleanup, merge, unlock, finish, recover, preflight, scope, pr-record, run, setup, commit-check, resolve-setup, or reassign."
      );
    process.stdout.write(
      `${JSON.stringify(commands[command](options), null, 2)}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
