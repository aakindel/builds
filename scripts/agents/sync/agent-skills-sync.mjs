// Skills are data. This command never imports or executes copied source helpers.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  atomicJSON,
  claudeFiles,
  digest,
  safePath,
  synchronize,
  treeFiles,
} from "../shared/agent-data.mjs";

export const skillSyncCommand =
  "[ ! -f scripts/agents/sync/sync-agent-skills.mjs ] || node scripts/agents/sync/sync-agent-skills.mjs --hook || true";

const readJSON = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
const emptyManifest = () => ({ version: 1, owned: {}, pending: {} });

// This optional, declarative registration travels with general-chat-doc.
// Merge only this Stop entry; retain every unrelated personal setting/hook.
function personalHookPlan(context) {
  const descriptor = safePath(
    context.root,
    ".agents/_root-agents/skills/general/general-chat-doc/claude-stop-hook.json"
  );
  const ownership = safePath(context.state, "personal-chat-hook.json");
  const prior = readJSON(ownership, { version: 1, owned: null });
  const file = safePath(context.home, ".claude/settings.json");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const settings = JSON.parse(before || "{}");
  const spec = readJSON(descriptor, null);
  let entry = null;
  if (spec) {
    if (
      spec.version !== 1 ||
      spec.event !== "Stop" ||
      spec.script !== "scripts/claude-stop.mjs" ||
      spec.timeout !== 10
    )
      throw new Error("Invalid general-chat-doc Stop-hook declaration.");
    entry = {
      hooks: [
        {
          type: "command",
          command:
            'node "$HOME/.agents/skills/general/general-chat-doc/scripts/claude-stop.mjs"',
          timeout: spec.timeout,
        },
      ],
    };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const list = settings.hooks?.Stop || [];
  if (!Array.isArray(list))
    throw new Error("Personal Claude Stop hooks must be an array.");
  const related = list.filter((item) =>
    item.hooks?.some((hook) =>
      hook.command?.includes("general-chat-doc/scripts/claude-stop.mjs")
    )
  );
  const conflict = related.some(
    (item) => !same(item, entry) && !same(item, prior.owned)
  );
  const current = entry
    ? related.length === 1 && same(related[0], entry)
    : related.length === 0;
  return {
    file,
    ownership,
    before,
    settings,
    prior,
    entry,
    conflict: conflict
      ? "Personal chat Stop hook changed independently."
      : null,
    status: conflict
      ? "pending"
      : current && same(prior.owned, entry)
        ? "synced"
        : "stale",
  };
}

function publishPersonalHook(plan) {
  if (plan.conflict || plan.status === "synced" || plan.blocked) return;
  const before = fs.existsSync(plan.file)
    ? fs.readFileSync(plan.file, "utf8")
    : null;
  if (before !== plan.before)
    throw new Error("Personal Claude settings changed during synchronization.");
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hooks = { ...plan.settings.hooks };
  const list = (hooks.Stop || []).filter(
    (item) => !same(item, plan.prior.owned) && !same(item, plan.entry)
  );
  if (plan.entry) list.push(plan.entry);
  if (list.length) hooks.Stop = list;
  else delete hooks.Stop;
  if (plan.entry || plan.before !== null)
    atomicJSON(plan.file, { ...plan.settings, hooks });
  atomicJSON(plan.ownership, { version: 1, owned: plan.entry });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  return (
    isRecord(value) && Object.keys(value).every((key) => allowed.includes(key))
  );
}

// skillsSync.personalSettings in .agents/environment.json declares the only
// machine-wide Claude setting this command owns: attribution.
function personalAttribution(root) {
  const config = readJSON(path.join(root, ".agents/environment.json"), {})
    .skillsSync?.personalSettings;
  if (config === undefined) return null;
  const attribution = config?.claude?.attribution;
  if (
    !onlyKeys(config, ["claude"]) ||
    (config.claude !== undefined &&
      !onlyKeys(config.claude, ["attribution"])) ||
    (attribution !== undefined &&
      (!onlyKeys(attribution, ["commit", "pr"]) ||
        typeof attribution.commit !== "string" ||
        typeof attribution.pr !== "string"))
  )
    throw new Error(
      "skillsSync.personalSettings accepts only claude.attribution with string commit and pr values."
    );
  return attribution === undefined
    ? null
    : { commit: attribution.commit, pr: attribution.pr };
}

// Merge only the attribution key. A value changed by hand is reported and kept.
function personalAttributionPlan(context) {
  const desired = personalAttribution(context.root);
  const ownership = safePath(context.state, "personal-attribution.json");
  const prior = readJSON(ownership, { version: 1, owned: null });
  const file = safePath(context.home, ".claude/settings.json");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const settings = JSON.parse(before || "{}");
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const current = settings.attribution;
  const ownedCurrent =
    current !== undefined && prior.owned !== null && same(current, prior.owned);
  const conflict =
    desired !== null &&
    current !== undefined &&
    !same(current, desired) &&
    !ownedCurrent;
  const done = desired !== null ? same(current, desired) : !ownedCurrent;
  return {
    file,
    ownership,
    before,
    settings,
    desired,
    remove: desired === null && ownedCurrent,
    conflict: conflict
      ? "Personal Claude attribution changed independently."
      : null,
    status: conflict
      ? "pending"
      : done && same(prior.owned, desired)
        ? "synced"
        : "stale",
  };
}

function publishPersonalAttribution(plan) {
  if (plan.conflict || plan.status === "synced") return;
  const before = fs.existsSync(plan.file)
    ? fs.readFileSync(plan.file, "utf8")
    : null;
  if (before !== plan.before)
    throw new Error("Personal Claude settings changed during synchronization.");
  const next = { ...plan.settings };
  if (plan.desired !== null) next.attribution = plan.desired;
  else if (plan.remove) delete next.attribution;
  if (JSON.stringify(next) !== JSON.stringify(plan.settings))
    atomicJSON(plan.file, next);
  atomicJSON(plan.ownership, { version: 1, owned: plan.desired });
}

export function syncContext({ root, home, env = process.env }) {
  root = fs.realpathSync(root);
  home = fs.realpathSync(home);
  const policy = readJSON(path.join(root, ".agents/environment.json"), {});
  const config = policy.skillsSync;
  if (!config || config.enabled === false)
    return { skipped: "skills-sync-not-enabled", root, home };
  if (
    config.enabled !== true ||
    typeof config.primary !== "string" ||
    (!path.isAbsolute(config.primary) && !config.primary.startsWith("~/"))
  )
    throw new Error(
      "skillsSync needs enabled: true and an absolute or ~/ primary checkout path."
    );
  if (
    env.CLAUDE_CODE_REMOTE === "true" ||
    ["1", "true"].includes(env.CODEX_CLOUD) ||
    ["1", "true"].includes(env.CI)
  )
    return { skipped: "cloud-or-ci", root, home };
  const primaryPath = config.primary.startsWith("~/")
    ? path.join(home, config.primary.slice(2))
    : config.primary;
  if (!fs.existsSync(primaryPath) || fs.realpathSync(primaryPath) !== root)
    return { skipped: "not-designated-primary", root, home };
  const git = (args) => {
    const result = spawnSync("/usr/bin/git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        PATH: "/usr/bin:/bin",
        HOME: home,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_NO_LAZY_FETCH: "1",
      },
      timeout: 10000,
    });
    if (result.status !== 0)
      throw new Error("Cannot inspect the skills source Git checkout.");
    return result.stdout.trim();
  };
  const primary = git(["worktree", "list", "--porcelain", "-z"])
    .split("\0")
    .find((item) => item.startsWith("worktree "))
    ?.slice(9);
  if (!primary || fs.realpathSync(primary) !== root)
    return { skipped: "not-primary-worktree", root, home };
  const head = git(["rev-parse", "HEAD"]);
  const host = readJSON(
    path.join(home, ".local/share/ui-library-agent-host/state.json"),
    null
  );
  if (host?.root === root && host.capabilities?.includes("machine"))
    throw new Error(
      "Registered host machine synchronization must be retired before standalone skills synchronization can write the same destinations."
    );
  const state = safePath(home, ".local/state/ui-library-agent-skills");
  const registration = readJSON(path.join(state, "source.json"), null);
  if (registration && registration.root !== root)
    throw new Error(
      "Another checkout owns the personal skills synchronization state."
    );
  return { root, home, head, state };
}

// Parent skills and their descendants publish together. References between
// different roots join their groups, including resources outside skill folders.
function publicationGroups(full, flat) {
  const roots = [...full.keys()]
    .filter((rel) => path.posix.basename(rel) === "SKILL.md")
    .map((rel) => path.posix.dirname(rel))
    .sort((a, b) => a.length - b.length);
  const contains = (parent, rel) =>
    parent === "." || rel === parent || rel.startsWith(parent + "/");
  const owner = (rel) =>
    roots.find((parent) => contains(parent, rel)) ??
    `@shared/${rel.split("/")[0]}`;
  const parents = new Map();
  const find = (group) => {
    if (!parents.has(group)) parents.set(group, group);
    if (parents.get(group) !== group)
      parents.set(group, find(parents.get(group)));
    return parents.get(group);
  };
  const join = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) {
      const first = a < b ? a : b;
      parents.set(a, first);
      parents.set(b, first);
    }
  };
  const owners = Object.fromEntries(
    [...full.keys()].map((rel) => [rel, owner(rel)])
  );
  for (const [rel, bytes] of full) {
    find(owners[rel]);
    if (!/\.(?:md|mdc|mjs|cjs|js|ts|tsx|json|sh|txt)$/.test(rel)) continue;
    const text = bytes.toString("utf8");
    for (const match of text.matchAll(
      /(?:["'`](\.{1,2}\/[^"'`\s]+)["'`]|\]\(<?(\.{1,2}\/[^\s)>]+)>?\))/g
    )) {
      const raw = (match[1] ?? match[2]).split(/[?#]/)[0];
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(rel), raw)
      );
      const linked = [
        target,
        `${target}.mjs`,
        `${target}.ts`,
        `${target}/SKILL.md`,
      ].find((candidate) => full.has(candidate));
      if (linked) join(owners[rel], owners[linked]);
      else
        for (const candidate of full.keys()) {
          if (candidate.startsWith(target + "/"))
            join(owners[rel], owners[candidate]);
        }
    }
  }
  const fullGroups = Object.fromEntries(
    Object.entries(owners).map(([rel, group]) => [rel, find(group)])
  );
  const flatOwners = new Map(
    roots.map((rel) => [path.posix.basename(rel), find(owner(rel))])
  );
  const flatGroups = Object.fromEntries(
    [...flat.keys()].map((rel) => [rel, flatOwners.get(rel.split("/")[0])])
  );
  return [fullGroups, flatGroups];
}

function inspectFile(job, rel) {
  let dest;
  try {
    dest = safePath(job.destination, rel);
  } catch (error) {
    if (error.message.startsWith("Linked"))
      return { conflict: "linked destination" };
    throw error;
  }
  const stat = fs.lstatSync(dest, { throwIfNoEntry: false });
  if (stat && !stat.isFile())
    return { conflict: "destination is not a regular file" };
  const live = stat ? digest(fs.readFileSync(dest)) : null;
  const mode = stat ? stat.mode & 0o777 : null;
  const incoming = job.files.has(rel) ? digest(job.files.get(rel)) : null;
  const wantedMode = job.files.has(rel)
    ? (job.files.get(rel).mode ?? 0o644)
    : null;
  const owned = job.prior.owned[rel];
  const pending = job.prior.pending[rel];
  if (live === incoming && (mode === wantedMode || live === null))
    return live !== null && owned === undefined ? { adopt: true } : {};
  const recovered =
    pending &&
    live === pending.after &&
    (pending.afterMode === undefined || mode === pending.afterMode);
  if (live !== null && live !== owned && live !== pending?.before && !recovered)
    return {
      conflict:
        owned === undefined
          ? "unmanaged copy differs"
          : "installed file changed independently",
    };
  if (
    live !== null &&
    !recovered &&
    job.prior.modes?.[rel] !== undefined &&
    mode !== job.prior.modes[rel] &&
    mode !== pending?.afterMode
  )
    return { conflict: "installed permissions changed independently" };
  if (live !== null && owned === undefined && !pending)
    return { conflict: "unmanaged copy differs" };
  return {
    change: incoming === null ? "remove" : live === null ? "create" : "update",
  };
}

export function skillsPlan(context) {
  if (context.skipped) return { ...context, status: "skipped" };
  const source = safePath(context.root, ".agents/_root-agents/skills");
  if (!fs.existsSync(source))
    throw new Error(
      "The authoritative skills source is missing; preserve installed copies."
    );
  const full = treeFiles(source);
  if (![...full.keys()].some((rel) => path.posix.basename(rel) === "SKILL.md"))
    throw new Error(
      "The authoritative skills source is empty; preserve installed copies."
    );
  const flat = claudeFiles(source);
  const groups = publicationGroups(full, flat);
  const sourceHash = digest(
    [...full]
      .map(([rel, bytes]) => `${rel}:${digest(bytes)}:${bytes.mode}`)
      .join("\n")
  );
  const engineHash = digest(
    [
      "scripts/agents/sync/sync-agent-skills.mjs",
      "scripts/agents/sync/agent-skills-sync.mjs",
      "scripts/agents/shared/agent-data.mjs",
    ]
      .map(
        (rel) =>
          `${rel}:${digest(fs.readFileSync(path.join(context.root, rel)))}`
      )
      .join("\n")
  );
  const jobs = [
    {
      name: "nested",
      destination: path.join(context.home, ".agents/skills"),
      files: full,
      groups: groups[0],
    },
    {
      name: "claude",
      destination: path.join(context.home, ".claude/skills"),
      files: flat,
      groups: groups[1],
    },
  ];
  const conflicts = [],
    changes = [],
    adoptions = [];
  const personalHook = personalHookPlan(context);
  if (personalHook.conflict)
    conflicts.push({
      destination: "claude-settings",
      path: ".claude/settings.json",
      group: "general/general-chat-doc",
      conflict: personalHook.conflict,
    });
  const personalAttributionState = personalAttributionPlan(context);
  if (personalAttributionState.conflict)
    conflicts.push({
      destination: "claude-settings",
      path: ".claude/settings.json",
      group: "personal-settings/claude-attribution",
      conflict: personalAttributionState.conflict,
    });
  for (const job of jobs) {
    job.manifest = safePath(context.state, `${job.name}.json`);
    job.prior = readJSON(job.manifest, emptyManifest());
    if (job.prior.version !== 1 || !job.prior.owned || !job.prior.pending)
      throw new Error(
        "Invalid skills ownership manifest; preserve installed copies."
      );
    job.paths = [
      ...new Set([
        ...Object.keys(job.prior.owned),
        ...Object.keys(job.prior.pending),
        ...job.files.keys(),
      ]),
    ];
    job.group = (rel) =>
      job.groups[rel] ??
      job.prior.groups?.[rel] ??
      `${job.name}:retired:${path.posix.dirname(rel)}`;
    const previousGroup = job.group;
    job.group = (rel) =>
      job.groups[rel] ??
      groups[0][(job.prior.groups?.[rel] ?? "") + "/SKILL.md"] ??
      previousGroup(rel);
    for (const rel of job.paths) {
      const entry = {
        destination: job.name,
        path: rel,
        group: job.group(rel),
        ...inspectFile(job, rel),
      };
      if (entry.conflict) conflicts.push(entry);
      if (entry.change) changes.push(entry);
      if (entry.adopt) adoptions.push(entry);
    }
  }
  const blocked = new Set(conflicts.map((entry) => entry.group));
  personalHook.blocked = blocked.has(
    groups[0]["general/general-chat-doc/SKILL.md"]
  );
  for (const job of jobs)
    job.skip = new Set(job.paths.filter((rel) => blocked.has(job.group(rel))));
  const allowed = (list) => list.filter((entry) => !blocked.has(entry.group));
  return {
    ...context,
    status: conflicts.length
      ? "pending"
      : changes.length ||
          adoptions.length ||
          personalHook.status === "stale" ||
          personalAttributionState.status === "stale"
        ? "stale"
        : "synced",
    sourceHash,
    engineHash,
    conflicts,
    blocked: [...blocked],
    changes: allowed(changes),
    adoptions: allowed(adoptions),
    personalHook,
    personalAttribution: personalAttributionState,
    jobs,
  };
}

export function skillsReport(plan) {
  const report = { ...plan };
  delete report.jobs;
  report.personalHook = {
    file: plan.personalHook.file,
    status: plan.personalHook.status,
    conflict: plan.personalHook.conflict,
  };
  report.personalAttribution = {
    file: plan.personalAttribution.file,
    status: plan.personalAttribution.status,
    conflict: plan.personalAttribution.conflict,
  };
  return report;
}

const transient = new Set(["EAGAIN", "EBUSY", "EINTR", "EMFILE", "ENFILE"]);
export function publishSkills(context, expected = {}) {
  const report = publishAttempt(context, expected);
  return report.status === "pending" && transient.has(report.code)
    ? publishAttempt(context, expected)
    : report;
}

function publishAttempt(
  context,
  { expectedHead, expectedSource, expectedEngine } = {}
) {
  if (context.skipped) return skillsReport(skillsPlan(context));
  const local = safePath(context.root, "zlocal/agent-skills-sync/status.json");
  let plan;
  const failure = (error) => {
    const report = {
      status: "pending",
      root: context.root,
      head: context.head,
      reason:
        error.code === "EACCES" || error.code === "EPERM"
          ? "permission"
          : "failure",
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(plan
        ? {
            sourceHash: plan.sourceHash,
            engineHash: plan.engineHash,
            retryCommand: retryCommand(plan),
          }
        : {}),
    };
    atomicJSON(local, report);
    return report;
  };
  let locked = false;
  try {
    plan = skillsPlan(context);
    if (
      (expectedHead && context.head !== expectedHead) ||
      (expectedSource && plan.sourceHash !== expectedSource) ||
      (expectedEngine && plan.engineHash !== expectedEngine)
    )
      throw new Error(
        "Reviewed skills-sync inputs changed; regenerate the preview before retrying."
      );
    safePath(context.state, "lock/owner.json");
    fs.mkdirSync(context.state, { recursive: true });
    try {
      fs.mkdirSync(path.join(context.state, "lock"));
    } catch (error) {
      if (error.code === "EEXIST")
        throw new Error(
          "Skills-sync lock exists; inspect its owner before recovery.",
          { cause: error }
        );
      throw error;
    }
    locked = true;
    atomicJSON(path.join(context.state, "lock/owner.json"), {
      pid: process.pid,
      root: context.root,
    });
    atomicJSON(path.join(context.state, "source.json"), {
      version: 1,
      root: context.root,
    });
    // Recheck under the lock so another run's writes are never mistaken for drift.
    const fresh = syncContext({ root: context.root, home: context.home });
    if (fresh.skipped || fresh.head !== context.head)
      throw new Error(
        "Skills source ownership or HEAD changed during publication preparation."
      );
    plan = skillsPlan(fresh);
    if (
      (expectedSource && plan.sourceHash !== expectedSource) ||
      (expectedEngine && plan.engineHash !== expectedEngine)
    )
      throw new Error(
        "Reviewed skills-sync inputs changed; regenerate the preview before retrying."
      );
    const backups = new Map();
    for (const entry of plan.changes) {
      const job = plan.jobs.find((job) => job.name === entry.destination);
      const file = safePath(job.destination, entry.path);
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      const bytes = stat ? fs.readFileSync(file) : null;
      if (bytes) bytes.mode = stat.mode & 0o777;
      backups.set(entry.destination + ":" + entry.path, bytes);
    }
    const reports = [];
    const late = [];
    for (const job of plan.jobs) {
      const report = synchronize({ ...job, adoptIdentical: true });
      for (const rel of report.conflicts) {
        const conflict = {
          destination: job.name,
          path: rel,
          group: job.group(rel),
          conflict: "installed file changed during publication",
        };
        late.push(conflict);
        for (const candidate of plan.jobs)
          for (const file of candidate.paths)
            if (candidate.group(file) === conflict.group)
              candidate.skip.add(file);
      }
      reports.push({ destination: job.name, ...report });
    }
    const observed = skillsPlan(
      syncContext({ root: context.root, home: context.home })
    );
    const known = new Set(
      [...plan.conflicts, ...late].map(
        (entry) => entry.destination + ":" + entry.path
      )
    );
    for (const entry of observed.conflicts) {
      if (!known.has(entry.destination + ":" + entry.path)) late.push(entry);
    }
    if (late.length) {
      const blocked = new Set([
        ...plan.blocked,
        ...late.map((entry) => entry.group),
      ]);
      for (const job of plan.jobs) {
        const changed = reports
          .find((report) => report.destination === job.name)
          .changes.filter((rel) => blocked.has(job.group(rel)));
        const rollback = new Map(),
          skip = new Set(job.paths);
        const restored = [],
          preserved = [];
        for (const rel of changed) {
          const file = safePath(job.destination, rel);
          const stat = fs.lstatSync(file, { throwIfNoEntry: false });
          const expected = job.files.get(rel);
          if (
            (stat ? digest(fs.readFileSync(file)) : null) !==
              (expected ? digest(expected) : null) ||
            (stat && expected && (stat.mode & 0o777) !== expected.mode)
          ) {
            preserved.push(rel);
            continue;
          }
          const before = backups.get(job.name + ":" + rel);
          if (before) rollback.set(rel, before);
          skip.delete(rel);
          restored.push(rel);
        }
        if (restored.length)
          synchronize({
            destination: job.destination,
            manifest: job.manifest,
            files: rollback,
            skip,
          });
        const report = reports.find(
          (report) => report.destination === job.name
        );
        report.rolledBack = restored;
        report.preservedConcurrent = preserved;
        report.changes = report.changes.filter(
          (rel) => !blocked.has(job.group(rel))
        );
      }
      plan.conflicts.push(...late);
      plan.blocked = [...blocked];
      plan.changes = plan.changes.filter((entry) => !blocked.has(entry.group));
      plan.adoptions = plan.adoptions.filter(
        (entry) => !blocked.has(entry.group)
      );
    }
    const final = late.length
      ? skillsPlan(syncContext({ root: context.root, home: context.home }))
      : observed;
    if (
      final.sourceHash !== plan.sourceHash ||
      final.engineHash !== plan.engineHash ||
      final.head !== plan.head
    )
      throw new Error(
        "Skills source changed during publication; synchronization is pending a new run."
      );
    if (final.changes.length || final.adoptions.length)
      throw new Error(
        "Installed skills changed during publication; synchronization is pending a new run."
      );
    plan.personalHook.blocked = plan.blocked.includes(
      plan.jobs[0].groups["general/general-chat-doc/SKILL.md"]
    );
    publishPersonalHook(plan.personalHook);
    final.personalHook = personalHookPlan(context);
    // Planned after the hook write, which changes the same settings file.
    publishPersonalAttribution(personalAttributionPlan(context));
    final.personalAttribution = personalAttributionPlan(context);
    const report = {
      ...skillsReport(plan),
      status:
        plan.conflicts.length || final.personalAttribution.conflict
          ? "pending"
          : "synced",
      personalHook: {
        file: final.personalHook.file,
        status: final.personalHook.status,
        conflict: final.personalHook.conflict,
      },
      personalAttribution: {
        file: final.personalAttribution.file,
        status: final.personalAttribution.status,
        conflict: final.personalAttribution.conflict,
      },
      reports,
      completedAt: new Date().toISOString(),
    };
    atomicJSON(path.join(context.state, "status.json"), report);
    atomicJSON(local, report);
    return report;
  } catch (error) {
    return failure(error);
  } finally {
    if (locked)
      fs.rmSync(path.join(context.state, "lock"), { recursive: true });
  }
}

export function retryCommand(plan) {
  const quote = (value) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
  return `node ${quote(path.join(plan.root, "scripts/agents/sync/sync-agent-skills.mjs"))} --project ${quote(plan.root)} --expected-head ${quote(plan.head)} --expected-source ${quote(plan.sourceHash)} --expected-engine ${quote(plan.engineHash)}`;
}

export function recoverSkillsLock(context) {
  const lock = safePath(context.state, "lock/owner.json");
  const owner = readJSON(lock, null);
  if (
    !owner ||
    owner.root !== context.root ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid <= 0
  )
    throw new Error(
      "Invalid or uncertain lock owner; preserve it for inspection."
    );
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    fs.rmSync(path.dirname(lock), { recursive: true });
    return { status: "recovered", root: context.root };
  }
  throw new Error("Skills-sync owner is still alive; preserve the lock.");
}
