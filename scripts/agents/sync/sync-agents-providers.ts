/* Rewrites provider hook, permission and settings files from
   `.agents/sync-policy.json`,
   and writes root CLAUDE.md that imports AGENTS.md. Cursor reads `.cursor/`,
   Claude Code reads CLAUDE.md, `.claude/settings.json`, and `.claude/rules/`
   (rules come from pnpm agents:rules). Codex reads `.codex/hooks.json`. Codex
   does not read Cursor or Claude permission files. Those paths are projections.
   Edit the agent sync policy and `.agents/rules`, not them.

   Run `pnpm agents:providers` to write, `pnpm agents:providers:check` to fail
   when a committed file no longer matches. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(
  process.env.AGENT_PROJECT_ROOT ??
    path.resolve(import.meta.dirname, "../../..")
);
const AGENTS_DIR = path.join(ROOT, ".agents");
const POLICY_PATH = path.join(AGENTS_DIR, "sync-policy.json");

const CURSOR_HOOKS_PATH = path.join(ROOT, ".cursor", "hooks.json");
const CURSOR_PERMISSIONS_PATH = path.join(ROOT, ".cursor", "permissions.json");
const CURSOR_CLI_PATH = path.join(ROOT, ".cursor", "cli.json");
const CLAUDE_SETTINGS_PATH = path.join(ROOT, ".claude", "settings.json");
const CLAUDE_MD_PATH = path.join(ROOT, "CLAUDE.md");
const CODEX_HOOKS_PATH = path.join(ROOT, ".codex", "hooks.json");
const GENERATED_NOTICE =
  "Generated from .agents/sync-policy.json. Do not edit. Run pnpm agents:providers.";
const CLAUDE_MD_NOTICE =
  "<!-- Generated from AGENTS.md. Do not edit. Run pnpm agents:providers. -->";

type Provider = "cursor" | "claude" | "codex";

type PolicyHook = {
  id: string;
  script: string;
  timeout?: number;
  failClosed?: boolean;
  events: Partial<Record<Provider, string>>;
  matcher?: Partial<Record<Provider, string>>;
};

type CursorCliPermissions = {
  allow?: string[];
  deny?: string[];
};

type CursorPermissions = {
  autoRun?: {
    allow_instructions?: string[];
    block_instructions?: string[];
  };
  terminalAllowlist?: string[];
  cli?: CursorCliPermissions;
};

type ClaudePermissions = {
  allow?: string[];
  ask?: string[];
  deny?: string[];
  sandbox?: {
    enabled?: boolean;
    failIfUnavailable?: boolean;
    allowUnsandboxedCommands?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    filesystem?: { denyRead?: string[] };
  };
};

type CodexPermissions = Record<string, unknown>;

type ClaudeAttribution = {
  commit: string;
  pr: string;
};

type ClaudeSettings = {
  attribution?: ClaudeAttribution;
};

type Policy = {
  version: number;
  hooks: PolicyHook[];
  permissions?: {
    cursor?: CursorPermissions;
    claude?: ClaudePermissions;
    codex?: CodexPermissions;
  };
  settings?: {
    claude?: ClaudeSettings;
  };
};

type CursorHookEntry = {
  command: string;
  timeout?: number;
  failClosed?: boolean;
  matcher?: string;
};

type ClaudeHookHandler = {
  type: "command";
  command: string;
  timeout?: number;
};

type CodexHookHandler = {
  type: "command";
  command: string;
  timeout?: number;
};

function relative(filePath: string) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value;
}

function asOptionalNumber(value: unknown, label: string) {
  if (value === undefined) return undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }

  return value;
}

function asOptionalBoolean(value: unknown, label: string) {
  if (value === undefined) return undefined;

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}

function asStringList(value: unknown, label: string) {
  if (value === undefined) return undefined;

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }

  return value;
}

function parseProviderMap({ value, label }: { value: unknown; label: string }) {
  if (value === undefined) return undefined;

  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  const result: Partial<Record<Provider, string>> = {};

  for (const provider of ["cursor", "claude", "codex"] as const) {
    if (value[provider] === undefined) continue;

    result[provider] = asString(value[provider], `${label}.${provider}`);
  }

  return result;
}

function parseHook({ value, index }: { value: unknown; index: number }) {
  if (!isRecord(value)) {
    throw new Error(`hooks[${index}] must be an object`);
  }

  const events = parseProviderMap({
    value: value.events,
    label: `hooks[${index}].events`,
  });

  if (!events || Object.keys(events).length === 0) {
    throw new Error(`hooks[${index}].events must name at least one provider`);
  }

  return {
    id: asString(value.id, `hooks[${index}].id`),
    script: asString(value.script, `hooks[${index}].script`),
    timeout: asOptionalNumber(value.timeout, `hooks[${index}].timeout`),
    failClosed: asOptionalBoolean(
      value.failClosed,
      `hooks[${index}].failClosed`
    ),
    events,
    matcher: parseProviderMap({
      value: value.matcher,
      label: `hooks[${index}].matcher`,
    }),
  } satisfies PolicyHook;
}

function parseCursorPermissions(value: unknown): CursorPermissions | undefined {
  if (value === undefined) return undefined;

  if (!isRecord(value)) {
    throw new Error("permissions.cursor must be an object");
  }

  let autoRun: CursorPermissions["autoRun"];

  if (value.autoRun !== undefined) {
    if (!isRecord(value.autoRun)) {
      throw new Error("permissions.cursor.autoRun must be an object");
    }

    autoRun = {
      allow_instructions: asStringList(
        value.autoRun.allow_instructions,
        "permissions.cursor.autoRun.allow_instructions"
      ),
      block_instructions: asStringList(
        value.autoRun.block_instructions,
        "permissions.cursor.autoRun.block_instructions"
      ),
    };
  }

  let cli: CursorCliPermissions | undefined;

  if (value.cli !== undefined) {
    if (!isRecord(value.cli)) {
      throw new Error("permissions.cursor.cli must be an object");
    }

    cli = {
      allow: asStringList(value.cli.allow, "permissions.cursor.cli.allow"),
      deny: asStringList(value.cli.deny, "permissions.cursor.cli.deny"),
    };
  }

  return {
    autoRun,
    terminalAllowlist: asStringList(
      value.terminalAllowlist,
      "permissions.cursor.terminalAllowlist"
    ),
    cli,
  };
}

function parseClaudePermissions(value: unknown): ClaudePermissions | undefined {
  if (value === undefined) return undefined;

  if (!isRecord(value)) {
    throw new Error("permissions.claude must be an object");
  }

  return {
    allow: asStringList(value.allow, "permissions.claude.allow"),
    ask: asStringList(value.ask, "permissions.claude.ask"),
    deny: asStringList(value.deny, "permissions.claude.deny"),
    sandbox: parseClaudeSandbox(value.sandbox),
  };
}

function parseClaudeSandbox(value: unknown): ClaudePermissions["sandbox"] {
  if (value === undefined) return undefined;
  const label = "permissions.claude.sandbox";
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const filesystem = value.filesystem;
  if (filesystem !== undefined && !isRecord(filesystem)) {
    throw new Error(`${label}.filesystem must be an object`);
  }
  return {
    enabled: asOptionalBoolean(value.enabled, `${label}.enabled`),
    failIfUnavailable: asOptionalBoolean(
      value.failIfUnavailable,
      `${label}.failIfUnavailable`
    ),
    allowUnsandboxedCommands: asOptionalBoolean(
      value.allowUnsandboxedCommands,
      `${label}.allowUnsandboxedCommands`
    ),
    autoAllowBashIfSandboxed: asOptionalBoolean(
      value.autoAllowBashIfSandboxed,
      `${label}.autoAllowBashIfSandboxed`
    ),
    ...(filesystem === undefined
      ? {}
      : {
          filesystem: {
            denyRead: asStringList(
              filesystem.denyRead,
              `${label}.filesystem.denyRead`
            ),
          },
        }),
  };
}

function parseCodexPermissions(value: unknown): CodexPermissions | undefined {
  if (value === undefined) return undefined;

  if (!isRecord(value)) {
    throw new Error("permissions.codex must be an object");
  }

  return value;
}

function rejectUnknownKeys({
  value,
  allowed,
  label,
}: {
  value: Record<string, unknown>;
  allowed: string[];
  label: string;
}) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));

  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
  }
}

function parseClaudeAttribution(value: unknown): ClaudeAttribution | undefined {
  if (value === undefined) return undefined;
  const label = "settings.claude.attribution";
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  rejectUnknownKeys({ value, allowed: ["commit", "pr"], label });

  for (const key of ["commit", "pr"] as const) {
    if (typeof value[key] !== "string") {
      throw new Error(`${label}.${key} must be a string`);
    }
  }

  return { commit: value.commit as string, pr: value.pr as string };
}

function parseSettings(value: unknown): Policy["settings"] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("settings must be an object");
  rejectUnknownKeys({ value, allowed: ["claude"], label: "settings" });

  if (value.claude === undefined) return {};
  if (!isRecord(value.claude)) {
    throw new Error("settings.claude must be an object");
  }
  rejectUnknownKeys({
    value: value.claude,
    allowed: ["attribution"],
    label: "settings.claude",
  });

  return {
    claude: { attribution: parseClaudeAttribution(value.claude.attribution) },
  };
}

function parsePolicy(value: unknown): Policy {
  if (!isRecord(value)) {
    throw new Error(".agents/sync-policy.json must be an object");
  }

  if (value.version !== 1) {
    throw new Error(".agents/sync-policy.json version must be 1");
  }

  if (!Array.isArray(value.hooks)) {
    throw new Error(".agents/sync-policy.json hooks must be an array");
  }

  const hooks = value.hooks.map((hook, index) =>
    parseHook({ value: hook, index })
  );
  const ids = new Set<string>();

  for (const hook of hooks) {
    if (ids.has(hook.id)) {
      throw new Error(`duplicate hook id: ${hook.id}`);
    }

    ids.add(hook.id);
  }

  let permissions: Policy["permissions"];

  if (value.permissions !== undefined) {
    if (!isRecord(value.permissions)) {
      throw new Error("permissions must be an object");
    }

    permissions = {
      cursor: parseCursorPermissions(value.permissions.cursor),
      claude: parseClaudePermissions(value.permissions.claude),
      codex: parseCodexPermissions(value.permissions.codex),
    };
  }

  return {
    version: 1,
    hooks,
    permissions,
    settings: parseSettings(value.settings),
  };
}

function resolveAgentScript(rel: string) {
  const abs = path.resolve(AGENTS_DIR, rel);
  const prefix = AGENTS_DIR.endsWith(path.sep)
    ? AGENTS_DIR
    : `${AGENTS_DIR}${path.sep}`;

  if (abs !== AGENTS_DIR && !abs.startsWith(prefix)) {
    throw new Error(`hook script escapes .agents/: ${rel}`);
  }

  if (!fs.existsSync(abs)) {
    throw new Error(`hook script is missing: ${relative(abs)}`);
  }

  return abs;
}

function repoCommand(script: string) {
  return `node ${path.posix.join(".agents", script.split(path.sep).join("/"))}`;
}

function claudeCommand(script: string) {
  return `node "$CLAUDE_PROJECT_DIR"/${path.posix.join(".agents", script.split(path.sep).join("/"))}`;
}

function codexCommand(script: string) {
  return `node "$(git rev-parse --show-toplevel)/${path.posix.join(".agents", script.split(path.sep).join("/"))}"`;
}

function addToEventMap<T>({
  map,
  eventName,
  entry,
}: {
  map: Map<string, T[]>;
  eventName: string;
  entry: T;
}) {
  const list = map.get(eventName) ?? [];

  list.push(entry);
  map.set(eventName, list);
}

function eventMapToObject<T>(map: Map<string, T[]>) {
  return Object.fromEntries(map);
}

function renderCursorHooks(hooks: PolicyHook[]) {
  const byEvent = new Map<string, CursorHookEntry[]>();

  for (const hook of hooks) {
    const eventName = hook.events.cursor;

    if (!eventName) continue;

    resolveAgentScript(hook.script);

    const entry: CursorHookEntry = {
      command: repoCommand(hook.script),
    };

    if (hook.timeout !== undefined) entry.timeout = hook.timeout;
    if (hook.failClosed !== undefined) entry.failClosed = hook.failClosed;
    if (hook.matcher?.cursor) entry.matcher = hook.matcher.cursor;

    addToEventMap({ map: byEvent, eventName, entry });
  }

  if (byEvent.size === 0) return null;

  return {
    description: GENERATED_NOTICE,
    version: 1,
    hooks: eventMapToObject(byEvent),
  };
}

function renderClaudeSettings({
  hooks,
  claude,
  settings,
}: {
  hooks: PolicyHook[];
  claude: ClaudePermissions | undefined;
  settings: ClaudeSettings | undefined;
}) {
  const byEvent = new Map<
    string,
    Array<{ matcher?: string; hooks: ClaudeHookHandler[] }>
  >();

  for (const hook of hooks) {
    const eventName = hook.events.claude;

    if (!eventName) continue;

    resolveAgentScript(hook.script);

    const handler: ClaudeHookHandler = {
      type: "command",
      command: claudeCommand(hook.script),
    };

    if (hook.timeout !== undefined) handler.timeout = hook.timeout;

    addToEventMap({
      map: byEvent,
      eventName,
      entry: {
        ...(hook.matcher?.claude ? { matcher: hook.matcher.claude } : {}),
        hooks: [handler],
      },
    });
  }

  const permissions = renderClaudePermissions(claude);

  if (
    byEvent.size === 0 &&
    permissions === null &&
    claude?.sandbox === undefined &&
    settings?.attribution === undefined
  )
    return null;

  return omitUndefined({
    description: GENERATED_NOTICE,
    attribution: settings?.attribution,
    permissions: permissions ?? undefined,
    sandbox: claude?.sandbox,
    hooks: byEvent.size > 0 ? eventMapToObject(byEvent) : undefined,
  });
}

function renderClaudePermissions(claude: ClaudePermissions | undefined) {
  const allow = claude?.allow;
  const ask = claude?.ask;
  const deny = claude?.deny;

  if (!hasItems(allow) && !hasItems(ask) && !hasItems(deny)) return null;

  return omitUndefined({
    allow: hasItems(allow) ? allow : undefined,
    ask: hasItems(ask) ? ask : undefined,
    deny: hasItems(deny) ? deny : undefined,
  });
}

function renderCodexHooks(hooks: PolicyHook[]) {
  const byEvent = new Map<
    string,
    Array<{ matcher?: string; hooks: CodexHookHandler[] }>
  >();

  for (const hook of hooks) {
    const eventName = hook.events.codex;

    if (!eventName) continue;

    resolveAgentScript(hook.script);

    const handler: CodexHookHandler = {
      type: "command",
      command: codexCommand(hook.script),
    };

    if (hook.timeout !== undefined) handler.timeout = hook.timeout;

    addToEventMap({
      map: byEvent,
      eventName,
      entry: {
        ...(hook.matcher?.codex ? { matcher: hook.matcher.codex } : {}),
        hooks: [handler],
      },
    });
  }

  if (byEvent.size === 0) return null;

  return {
    description: GENERATED_NOTICE,
    hooks: eventMapToObject(byEvent),
  };
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

function hasItems(value: string[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function renderCursorPermissions(cursor: CursorPermissions | undefined) {
  const allow = cursor?.autoRun?.allow_instructions;
  const block = cursor?.autoRun?.block_instructions;
  const hasAutoRun = hasItems(allow) || hasItems(block);
  const terminalAllowlist = cursor?.terminalAllowlist;

  if (!hasAutoRun && !hasItems(terminalAllowlist)) return null;

  return omitUndefined({
    autoRun: hasAutoRun
      ? omitUndefined({
          allow_instructions: allow,
          block_instructions: block,
        })
      : undefined,
    terminalAllowlist: hasItems(terminalAllowlist)
      ? terminalAllowlist
      : undefined,
  });
}

function renderClaudeMd() {
  return `@AGENTS.md\n\n${CLAUDE_MD_NOTICE}\n`;
}

function renderCursorCli(cli: CursorCliPermissions | undefined) {
  if (!cli) return null;
  if (!hasItems(cli.allow) && !hasItems(cli.deny)) return null;

  return {
    description: GENERATED_NOTICE,
    permissions: omitUndefined({
      allow: cli.allow,
      deny: cli.deny,
    }),
  };
}

function formatJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeFile({
  filePath,
  contents,
}: {
  filePath: string;
  contents: string;
}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function removeFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  let dir = path.dirname(filePath);

  while (dir !== ROOT && dir.startsWith(ROOT)) {
    if (!fs.existsSync(dir)) break;

    if (fs.readdirSync(dir).length > 0) break;

    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

function fileMatches({
  filePath,
  contents,
}: {
  filePath: string;
  contents: string | null;
}) {
  const exists = fs.existsSync(filePath);

  if (contents === null) return !exists;

  return exists && fs.readFileSync(filePath, "utf8") === contents;
}

function loadPolicy() {
  if (!fs.existsSync(POLICY_PATH)) {
    throw new Error(`${relative(POLICY_PATH)} is missing.`);
  }

  try {
    return parsePolicy(JSON.parse(fs.readFileSync(POLICY_PATH, "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${relative(POLICY_PATH)} is not valid JSON.`, {
        cause: error,
      });
    }

    throw error;
  }
}

function plannedFiles(policy: Policy) {
  const cursor = policy.permissions?.cursor;
  const claude = policy.permissions?.claude;
  const cli = renderCursorCli(cursor?.cli);

  const jsonFiles = [
    { filePath: CURSOR_HOOKS_PATH, value: renderCursorHooks(policy.hooks) },
    {
      filePath: CURSOR_PERMISSIONS_PATH,
      value: renderCursorPermissions(cursor),
    },
    {
      filePath: CLAUDE_SETTINGS_PATH,
      value: renderClaudeSettings({
        hooks: policy.hooks,
        claude,
        settings: policy.settings?.claude,
      }),
    },
    { filePath: CODEX_HOOKS_PATH, value: renderCodexHooks(policy.hooks) },
    {
      filePath: CURSOR_CLI_PATH,
      value: cli,
    },
  ].map((file) => ({
    filePath: file.filePath,
    contents: file.value === null ? null : formatJson(file.value),
  }));

  return [
    { filePath: CLAUDE_MD_PATH, contents: renderClaudeMd() },
    ...jsonFiles,
  ];
}

function main() {
  const isCheck = process.argv.includes("--check");
  let policy: Policy;

  try {
    policy = loadPolicy();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;

    return;
  }

  let files: ReturnType<typeof plannedFiles>;

  try {
    files = plannedFiles(policy);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;

    return;
  }

  const written = files.filter((file) => file.contents !== null);
  const skipped = files.filter((file) => file.contents === null);
  const hooksDir = path.join(AGENTS_DIR, "hooks");
  const hasHookScripts =
    fs.existsSync(hooksDir) &&
    fs.readdirSync(hooksDir).some((name) => !name.startsWith("."));
  const skippedPaths = [
    ...skipped.map((file) => relative(file.filePath)),
    ...(policy.hooks.length === 0 && !hasHookScripts ? [".agents/hooks"] : []),
  ];

  function writeSkipNotice() {
    if (skippedPaths.length === 0) return;

    process.stdout.write(
      `Not created (no content): ${skippedPaths.join(", ")}\n`
    );
  }

  function writeCodexNotice() {
    const hasCodexHooks = files.some(
      (file) => file.filePath === CODEX_HOOKS_PATH && file.contents !== null
    );
    const hasCodexPermissions = policy.permissions?.codex !== undefined;

    if (!hasCodexHooks && !hasCodexPermissions) return;

    process.stdout.write(
      "Codex: project `.codex/` must be trusted, and `/hooks` must trust generated hooks after they change. Do not pass --dangerously-bypass-hook-trust. Host sandbox and tool approval override repository files. permissions.codex is user-owned and is not written to a Codex file.\n"
    );
  }

  if (!isCheck) {
    for (const file of files) {
      if (file.contents === null) {
        removeFile(file.filePath);
        continue;
      }

      writeFile({ filePath: file.filePath, contents: file.contents });
    }

    process.stdout.write(
      written.length > 0
        ? `Wrote ${written.map((file) => relative(file.filePath)).join(", ")} from ${relative(POLICY_PATH)} (${policy.hooks.length} hooks)\n`
        : `No provider files to write from ${relative(POLICY_PATH)} (${policy.hooks.length} hooks)\n`
    );
    writeSkipNotice();
    writeCodexNotice();

    return;
  }

  const stale = files.filter((file) => !fileMatches(file));

  if (stale.length === 0) {
    process.stdout.write(
      `Provider files match ${relative(POLICY_PATH)} (${policy.hooks.length} hooks)\n`
    );
    writeSkipNotice();
    writeCodexNotice();

    return;
  }

  process.stderr.write(
    `Provider files are stale: ${stale.map((file) => relative(file.filePath)).join(", ")}. Run \`pnpm agents:providers\` and commit the result.\n`
  );
  process.exitCode = 1;
}

main();
