// dev-depth-managed: 1

import { randomUUID } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaults = { DEV_DEPTH: "shallow", DEV_DEPTH_LOG_RUNS: false };
const phases = [
  "reading-planning",
  "implementation",
  "static-checks",
  "server",
  "testing",
  "review",
  "reporting",
  "waiting",
];
const marker = "\n<!-- dev-depth-state -->\n";

function fileState(filename) {
  filename = path.resolve(filename);
  const stat = lstatSync(filename, { throwIfNoEntry: false });
  if (!stat) return { filename, target: filename, before: undefined };
  if (!stat.isFile() && !stat.isSymbolicLink())
    throw new Error(`Settings must be a file: ${filename}`);
  return {
    filename,
    target: realpathSync(filename),
    before: readFileSync(filename, "utf8"),
    mode: statSync(filename).mode & 0o777,
  };
}

function parseSettings(state) {
  const value = state.before === undefined ? {} : JSON.parse(state.before);
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error(`Expected a JSON object in ${state.filename}`);
  return value;
}

function ownSettings(value, legacy = false) {
  const logging = legacy ? "LOG_RUNS" : "DEV_DEPTH_LOG_RUNS";
  if (
    (legacy || value.DEV_DEPTH !== undefined) &&
    !["shallow", "deep"].includes(value.DEV_DEPTH)
  )
    throw new Error('Expected DEV_DEPTH "shallow" or "deep"');
  if (
    (legacy || value[logging] !== undefined) &&
    typeof value[logging] !== "boolean"
  )
    throw new Error(`Expected a boolean ${logging}`);
  return {
    DEV_DEPTH: value.DEV_DEPTH ?? defaults.DEV_DEPTH,
    DEV_DEPTH_LOG_RUNS: value[logging] ?? defaults.DEV_DEPTH_LOG_RUNS,
  };
}

function assertUnchanged(state) {
  const current = fileState(state.filename);
  if (current.target !== state.target || current.before !== state.before)
    throw new Error(
      `Settings changed during the operation; preserved: ${state.filename}`
    );
}

function writeSettings(state, value) {
  assertUnchanged(state);
  mkdirSync(path.dirname(state.target), { recursive: true });
  const temp = `${state.target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
      mode: state.mode ?? 0o600,
    });
    assertUnchanged(state);
    if (state.before === undefined) linkSync(temp, state.target);
    else renameSync(temp, state.target);
  } finally {
    if (lstatSync(temp, { throwIfNoEntry: false })) unlinkSync(temp);
  }
}

export function readConfig(root) {
  const filename = path.join(root, "zlocal/dev-config.json");
  try {
    const state = fileState(filename);
    if (state.before === undefined) {
      try {
        writeSettings(state, defaults);
      } catch (error) {
        // A competing initializer may have published the config first.
        if (!lstatSync(filename, { throwIfNoEntry: false })) throw error;
      }
    }
    return ownSettings(parseSettings(fileState(filename)));
  } catch (error) {
    return {
      ...defaults,
      warning: `Invalid dev-depth settings preserved; using shallow with logging off: ${error.message}`,
    };
  }
}

// Preflight is read-only so an installer can reject every conflict before writes.
export function planMigration(root) {
  root = path.resolve(root);
  const destination = fileState(path.join(root, "zlocal/dev-config.json"));
  const existing = parseSettings(destination);
  ownSettings(existing);
  const legacy = fileState(path.join(root, "zlocal/dev-depth.json"));
  const imported =
    legacy.before === undefined
      ? defaults
      : ownSettings(parseSettings(legacy), true);
  const settings = {
    ...existing,
    DEV_DEPTH: existing.DEV_DEPTH ?? imported.DEV_DEPTH,
    DEV_DEPTH_LOG_RUNS:
      existing.DEV_DEPTH_LOG_RUNS ?? imported.DEV_DEPTH_LOG_RUNS,
  };
  return { root, destination, legacy, settings };
}

export function migrate(root, plan = planMigration(root)) {
  if (path.resolve(root) !== plan.root)
    throw new Error("Migration root mismatch");
  assertUnchanged(plan.destination);
  assertUnchanged(plan.legacy);
  const existing = parseSettings(plan.destination);
  if (
    existing.DEV_DEPTH === undefined ||
    existing.DEV_DEPTH_LOG_RUNS === undefined
  )
    writeSettings(plan.destination, plan.settings);
  const saved = fileState(plan.destination.filename);
  const config = ownSettings(parseSettings(saved));
  let archive;
  if (plan.legacy.before !== undefined) {
    const directory = path.join(
      plan.root,
      "zlocal/artifacts/dev-depth-migrations"
    );
    mkdirSync(directory, { recursive: true });
    archive = path.join(
      directory,
      `${Date.now()}-${randomUUID()}-dev-depth.json`
    );
    writeFileSync(archive, plan.legacy.before, { flag: "wx", mode: 0o600 });
    assertUnchanged(saved);
    assertUnchanged(plan.legacy);
    // Retire only the legacy path in the selected checkout, including a link.
    unlinkSync(plan.legacy.filename);
  }
  return {
    config,
    migration: archive ? "migrated" : "ready",
    ...(archive ? { archive } : {}),
  };
}

function logPath(root, id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("Invalid run ID");
  return path.join(root, "zlocal/artifacts/dev-depth-logs", `${id}.md`);
}

function clean(value) {
  return String(value)
    .replace(/[\r\n|]/g, " ")
    .replace(/</g, "&lt;");
}

function seconds(ms) {
  return (ms / 1000).toFixed(3);
}

function save(root, state) {
  const end = state.ended ?? state.updated;
  const totals = {};
  for (let i = 0; i < state.phases.length; i++) {
    const phase = state.phases[i];
    const duration = (state.phases[i + 1]?.at ?? end) - phase.at;
    totals[phase.name] = (totals[phase.name] ?? 0) + duration;
  }
  const lines = [
    `# ${clean(state.task)}`,
    "",
    `- Run: ${state.id}`,
    `- Depth: ${state.config.DEV_DEPTH}`,
    `- Status: ${state.status}`,
    `- Started: ${new Date(state.started).toISOString()}`,
    `- Last recorded: ${new Date(state.updated).toISOString()}`,
    `- Ended: ${state.ended === undefined ? "Not finalized" : new Date(state.ended).toISOString()}`,
    `- Recorded elapsed: ${seconds(end - state.started)} s`,
    `- Waiting: ${seconds(totals.waiting ?? 0)} s`,
    `- Elapsed excluding waits: ${seconds(end - state.started - (totals.waiting ?? 0))} s`,
    "",
    "Phase durations measure elapsed intervals, not active reasoning or CPU time. In-progress logs end at the last recorded event. Command durations may overlap and are not added to phase totals.",
    "",
    "| Phase | Seconds |",
    "| --- | ---: |",
    ...Object.entries(totals).map(
      ([name, ms]) => `| ${name} | ${seconds(ms)} |`
    ),
    "",
    "| Check command | Seconds | Exit code |",
    "| --- | ---: | --- |",
    ...state.commands.map(
      (command) =>
        `| ${clean(command.label)} | ${command.end === undefined ? "Pending" : seconds(command.end - command.start)} | ${command.exit ?? "Pending"} |`
    ),
    "",
    "## Notes",
    "",
    ...state.notes.map((note) => `- ${clean(note)}`),
  ];
  const filename = logPath(root, state.id);
  mkdirSync(path.dirname(filename), { recursive: true });
  const temp = `${filename}.${randomUUID()}.tmp`;
  writeFileSync(
    temp,
    `${lines.join("\n")}\n${marker}${JSON.stringify(state)}\n`
  );
  renameSync(temp, filename);
  return filename;
}

export function start(root, task, now = Date.now()) {
  if (!task) throw new Error("A task summary is required");
  const config = readConfig(root);
  if (!config.DEV_DEPTH_LOG_RUNS) return { config, run: "off" };
  const slug =
    task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "task";
  const id = `${new Date(now).toISOString().replace(/[^0-9]/g, "")}-${randomUUID()}-${slug}`;
  const state = {
    id,
    task,
    config,
    started: now,
    updated: now,
    status: "in_progress",
    phases: [{ name: "reading-planning", at: now }],
    commands: [],
    notes: [],
  };
  return { config, run: id, log: save(root, state) };
}

export function update(root, id, action, args, now = Date.now()) {
  if (id === "off") return { run: "off" };
  const state = JSON.parse(
    readFileSync(logPath(root, id), "utf8").split(marker).at(-1)
  );
  if (state.id !== id) throw new Error("Run ID mismatch");
  if (state.status !== "in_progress")
    throw new Error("Run is already finalized");
  if (now < state.updated)
    throw new Error("Clock moved backwards; timing update refused");
  const [value, extra] = args;
  if (action === "phase") {
    if (!phases.includes(value)) throw new Error(`Unknown phase: ${value}`);
    state.phases.push({ name: value, at: now });
  } else if (action === "note") {
    if (!value) throw new Error("A note is required");
    state.notes.push(value);
  } else if (action === "command-start") {
    if (
      !value ||
      !extra ||
      state.commands.some((command) => command.id === value)
    )
      throw new Error("A unique command ID and label are required");
    state.commands.push({ id: value, label: extra, start: now });
  } else if (action === "command-end") {
    const command = state.commands.find((entry) => entry.id === value);
    if (!command || command.end !== undefined || !/^-?\d+$/.test(extra ?? ""))
      throw new Error("An open command ID and integer exit code are required");
    Object.assign(command, { end: now, exit: Number(extra) });
  } else if (action === "finish") {
    if (!["completed", "blocked", "cancelled", "failed"].includes(value))
      throw new Error("Invalid outcome");
    if (state.commands.some((command) => command.end === undefined))
      throw new Error("Record pending command outcomes before finishing");
    state.status = value;
    state.ended = now;
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
  state.updated = now;
  return { run: id, log: save(root, state) };
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [action, first, ...args] = process.argv.slice(2);
    const result =
      action === "migrate"
        ? migrate(process.cwd())
        : action === "start"
          ? start(process.cwd(), first)
          : update(process.cwd(), first, action, args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.config?.warning)
      process.stderr.write(`${result.config.warning}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
