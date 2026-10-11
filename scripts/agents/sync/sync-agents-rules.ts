/* Rewrites the <!-- agent-rules-* --> section in AGENTS.md from `.agents/rules`,
   and writes Claude-native copies under `.claude/rules/`. Codex loads the
   AGENTS.md index and must read the linked `.mdc` files. Cursor also loads the
   `.mdc` files directly. Claude Code loads `.md` files from `.claude/rules/`
   (and CLAUDE.md, which imports AGENTS.md via pnpm agents:providers).

   Split is from frontmatter: `alwaysApply: true` vs everything else (description
   or `globs`). The rule bodies stay in the `.mdc` files. AGENTS.md is an index.
   Do not inline those bodies: Codex concatenates project instruction files into
   one chain capped at 32 KiB (`project_doc_max_bytes`). `.claude/rules/` copies
   always-applied and glob-scoped rules. Description-only rules have no Claude
   equivalent and stay in the index.

   Run `pnpm agents:rules` to write, `pnpm agents:rules:check` to fail when the
   committed section or Claude copies no longer match the folder. */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(
  process.env.AGENT_PROJECT_ROOT ??
    path.resolve(import.meta.dirname, "../../..")
);
const RULES_DIR = path.join(ROOT, ".agents", "rules");
const AGENTS_PATH = path.join(ROOT, "AGENTS.md");
const CLAUDE_RULES_DIR = path.join(ROOT, ".claude", "rules");
const START_MARKER = "<!-- agent-rules-start -->";
const END_MARKER = "<!-- agent-rules-end -->";
const GENERATED_NOTICE =
  "<!-- Generated from .agents/rules. Do not edit. Run pnpm agents:rules. -->";
const PROJECT_DOC_MAX_BYTES = 32 * 1024;
const PROJECT_DOC_WARN_BYTES = 24 * 1024;

function relative(filePath: string) {
  return path.relative(ROOT, filePath);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseScalar(raw: string) {
  const trimmed = raw.trim();

  if (/^(true|yes)$/i.test(trimmed)) return true;

  if (/^(false|no)$/i.test(trimmed)) return false;

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((part) => unquote(part.trim()))
      .filter(Boolean);
  }

  return unquote(trimmed);
}

function readIndentedBlock({
  lines,
  startIndex,
}: {
  lines: string[];
  startIndex: number;
}) {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      collected.push("");
      index += 1;
      continue;
    }

    if (!/^\s/.test(line)) break;

    collected.push(line.trim());
    index += 1;
  }

  return { value: collected.join(" "), nextIndex: index };
}

function readDashList({
  lines,
  startIndex,
}: {
  lines: string[];
  startIndex: number;
}) {
  const values: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(/^\s+-\s+(.*)$/);

    if (!match) break;

    values.push(unquote(match[1].trim()));
    index += 1;
  }

  return values.length > 0
    ? { values, nextIndex: index }
    : { values: null, nextIndex: startIndex };
}

function parseYamlish(block: string) {
  const lines = block.split(/\r?\n/);
  const fields = new Map<string, string | boolean | string[]>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z][\w]*)\s*:\s*(.*)$/);

    if (!keyMatch) {
      index += 1;
      continue;
    }

    const key = keyMatch[1];
    const rest = keyMatch[2];

    if (rest === ">" || rest === ">-" || rest === "|" || rest === "|-") {
      const blockValue = readIndentedBlock({
        lines,
        startIndex: index + 1,
      });

      fields.set(key, collapseWhitespace(blockValue.value));
      index = blockValue.nextIndex;
      continue;
    }

    if (rest === "") {
      const list = readDashList({ lines, startIndex: index + 1 });

      if (list.values) {
        fields.set(key, list.values);
        index = list.nextIndex;
        continue;
      }

      fields.set(key, "");
      index += 1;
      continue;
    }

    fields.set(key, parseScalar(rest));
    index += 1;
  }

  return fields;
}

function asStringList(value: string | boolean | string[] | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => collapseWhitespace(String(item)))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [collapseWhitespace(value)];
  }

  return [];
}

function parseFrontmatter(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!match) {
    return { alwaysApply: false, description: "", globs: [] as string[] };
  }

  const fields = parseYamlish(match[1]);
  const alwaysApply = fields.get("alwaysApply");

  return {
    alwaysApply: alwaysApply === true,
    description:
      typeof fields.get("description") === "string"
        ? collapseWhitespace(fields.get("description") as string)
        : "",
    globs: asStringList(fields.get("globs")),
  };
}

type Rule = ReturnType<typeof parseFrontmatter> & {
  title: string;
  href: string;
  claudeRel: string;
  body: string;
};

function splitMarkdown(source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const frontmatter = parseFrontmatter(source);

  if (!match) {
    return { frontmatter, body: source.replace(/\s+$/, "") };
  }

  return {
    frontmatter,
    body: source
      .slice(match[0].length)
      .replace(/^\r?\n/, "")
      .replace(/\s+$/, ""),
  };
}

function listRuleFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
      return [];
    }

    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) return listRuleFiles(entryPath);

    return entry.isFile() && /\.(mdc|md)$/.test(entry.name) ? [entryPath] : [];
  });
}

function collectRules(): Rule[] {
  return listRuleFiles(RULES_DIR)
    .sort((a, b) => relative(a).localeCompare(relative(b)))
    .map((filePath) => {
      const repoPath = relative(filePath).split(path.sep).join("/");
      const { frontmatter, body } = splitMarkdown(
        fs.readFileSync(filePath, "utf8")
      );
      const relFromRules = path
        .relative(RULES_DIR, filePath)
        .split(path.sep)
        .join("/");
      const claudeRel = relFromRules.replace(/\.(mdc|md)$/, ".md");

      return {
        title: path.parse(filePath).name,
        href: `/${repoPath}`,
        claudeRel,
        body,
        ...frontmatter,
      };
    });
}

function renderClaudeRule(rule: Rule) {
  if (!rule.alwaysApply && rule.globs.length === 0) return null;

  const body = rule.body.length > 0 ? `${rule.body}\n` : "";

  if (rule.alwaysApply) {
    return `${GENERATED_NOTICE}\n\n${body}`;
  }

  const paths = rule.globs.map((glob) => `  - ${glob}`).join("\n");

  return `---\npaths:\n${paths}\n---\n\n${GENERATED_NOTICE}\n\n${body}`;
}

function plannedClaudeRuleFiles(rules: Rule[]) {
  return rules.flatMap((rule) => {
    const contents = renderClaudeRule(rule);

    if (contents === null) return [];

    return [
      {
        filePath: path.join(CLAUDE_RULES_DIR, ...rule.claudeRel.split("/")),
        contents,
      },
    ];
  });
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) return listFiles(entryPath);

    return entry.isFile() ? [entryPath] : [];
  });
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
  contents: string;
}) {
  return (
    fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === contents
  );
}

function agentsMdSizeWarning(contents: string) {
  const bytes = Buffer.byteLength(contents, "utf8");

  if (bytes < PROJECT_DOC_WARN_BYTES) return "";

  const pct = Math.round((bytes / PROJECT_DOC_MAX_BYTES) * 100);

  if (bytes >= PROJECT_DOC_MAX_BYTES) {
    return `Warning: AGENTS.md is ${bytes} bytes (${pct}% of Codex's ${PROJECT_DOC_MAX_BYTES}-byte instruction-chain cap). Codex will truncate the chain. Keep rule bodies in .agents/rules and cut other root AGENTS.md text rather than inlining rules.\n`;
  }

  return `Warning: AGENTS.md is ${bytes} bytes (${pct}% of Codex's ${PROJECT_DOC_MAX_BYTES}-byte instruction-chain cap). Nested AGENTS.md files share that budget. Keep rule bodies in .agents/rules.\n`;
}

function formatRuleItem({
  title,
  href,
  description,
  globs,
}: {
  title: string;
  href: string;
  description: string;
  globs: string[];
}) {
  const link = `[${title}](${href})`;
  const extras = [
    description,
    globs.length > 0
      ? `Applies to ${globs.map((glob) => `\`${glob}\``).join(", ")}.`
      : "",
  ].filter(Boolean);

  return extras.length > 0 ? `- ${link} — ${extras.join(" ")}` : `- ${link}`;
}

function renderSection(rules: Rule[]) {
  const always = rules.filter((rule) => rule.alwaysApply);
  const whenRelevant = rules.filter((rule) => !rule.alwaysApply);
  const loadNote = [
    always.length > 0
      ? "Before work, read every always-applied rule body, then follow it for the rest of the session."
      : "",
    whenRelevant.length > 0
      ? "Read a when-relevant rule body when its description matches the task."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const intro = loadNote
    ? [
        `Codex loads this index, not the linked \`.mdc\` files. ${loadNote} Cursor also loads the \`.mdc\` files directly.`,
        "Keep rule bodies in `.agents/rules`. Codex concatenates project instruction files (`AGENTS.md`, nested `AGENTS.override.md`) into one chain capped at 32 KiB by default (`project_doc_max_bytes`). Inlining those bodies would consume that budget. Files the agent reads from the links do not.",
      ].join("\n\n")
    : "";
  const lines = [START_MARKER, "", GENERATED_NOTICE, "", "## Agent Rules"];

  if (intro) {
    lines.push("", intro);
  }

  if (always.length > 0) {
    lines.push("", "### Always applied", "");
    lines.push(...always.map((rule) => formatRuleItem(rule)));
  }

  if (whenRelevant.length > 0) {
    lines.push("", "### When relevant", "");
    lines.push(...whenRelevant.map((rule) => formatRuleItem(rule)));
  }

  lines.push("", END_MARKER, "");

  return lines.join("\n");
}

function applySection({
  source,
  section,
}: {
  source: string;
  section: string;
}) {
  const start = source.indexOf(START_MARKER);
  const end =
    start === -1 ? -1 : source.indexOf(END_MARKER, start + START_MARKER.length);

  if (start === -1 || end === -1) {
    throw new Error(
      "AGENTS.md is missing <!-- agent-rules-start --> / <!-- agent-rules-end --> markers."
    );
  }

  const before = source.slice(0, start);
  const after = source.slice(end + END_MARKER.length).replace(/^\r?\n/, "");

  return `${before}${section}${after.length > 0 ? `${after}` : ""}`;
}

function main() {
  const isCheck = process.argv.includes("--check");

  if (!fs.existsSync(AGENTS_PATH)) {
    process.stderr.write("AGENTS.md is missing.\n");
    process.exitCode = 1;

    return;
  }

  const rules = collectRules();
  const alwaysCount = rules.filter((rule) => rule.alwaysApply).length;
  const whenRelevantCount = rules.length - alwaysCount;
  const claudeFiles = plannedClaudeRuleFiles(rules);
  const plannedPaths = new Set(claudeFiles.map((file) => file.filePath));
  const extraClaudeFiles = listFiles(CLAUDE_RULES_DIR).filter(
    (filePath) =>
      !plannedPaths.has(filePath) &&
      fs.readFileSync(filePath, "utf8").includes(GENERATED_NOTICE)
  );
  for (const file of claudeFiles) {
    if (
      fs.existsSync(file.filePath) &&
      !fs.readFileSync(file.filePath, "utf8").includes(GENERATED_NOTICE)
    ) {
      throw new Error(
        `Unmanaged Claude rule preserved: ${relative(file.filePath)}`
      );
    }
  }
  let next: string;

  try {
    next = applySection({
      source: fs.readFileSync(AGENTS_PATH, "utf8"),
      section: renderSection(rules),
    });
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;

    return;
  }

  if (!isCheck) {
    fs.writeFileSync(AGENTS_PATH, next);

    for (const file of claudeFiles) {
      writeFile(file);
    }

    for (const filePath of extraClaudeFiles) {
      removeFile(filePath);
    }

    process.stdout.write(
      `Wrote ${relative(AGENTS_PATH)} agent-rules section (${alwaysCount} always, ${whenRelevantCount} when-relevant, ${claudeFiles.length} Claude rules)\n`
    );
    process.stderr.write(agentsMdSizeWarning(next));

    return;
  }

  const stale = [
    ...(fs.readFileSync(AGENTS_PATH, "utf8") === next ? [] : [AGENTS_PATH]),
    ...claudeFiles
      .filter((file) => !fileMatches(file))
      .map((file) => file.filePath),
    ...extraClaudeFiles,
  ];

  if (stale.length === 0) {
    process.stdout.write(
      `${relative(AGENTS_PATH)} agent-rules section is up to date (${claudeFiles.length} Claude rules)\n`
    );
    process.stderr.write(agentsMdSizeWarning(next));

    return;
  }

  process.stderr.write(
    `Agent rule files are stale: ${stale.map((filePath) => relative(filePath).split(path.sep).join("/")).join(", ")}. Run \`pnpm agents:rules\` and commit the result.\n`
  );
  process.exitCode = 1;
}

main();
