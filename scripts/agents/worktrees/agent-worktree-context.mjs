// agent-worktrees-managed: 1

// Read-only host adapter. It reports evidence; it never creates a binding.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { project, t3Thread } from "./agent-worktrees.mjs";

export function context({
  cwd = process.cwd(),
  provider,
  threadId,
  assignedRoot,
  assignmentKind = "linked",
  payload = {},
} = {}) {
  if (!["codex", "claude", "cursor", "t3"].includes(provider))
    throw new Error("Choose codex, claude, cursor, or t3.");
  const current = project(payload.cwd ?? cwd);
  // T3 evidence is its own thread record for this worktree, not the path.
  const t3 =
    provider === "t3" && current.current !== current.primary
      ? t3Thread(current.primary, current.current)
      : undefined;
  const id =
    threadId ??
    t3?.threadId ??
    (provider === "codex"
      ? process.env.CODEX_THREAD_ID
      : provider === "claude"
        ? payload.session_id
        : undefined);
  const explicit = assignedRoot ? fs.realpathSync(assignedRoot) : undefined;
  if (
    explicit &&
    (explicit !== current.current ||
      (explicit === current.primary && assignmentKind !== "cloud") ||
      (assignmentKind === "cloud" && explicit !== current.primary))
  )
    throw new Error("Assignment must name the current linked checkout.");
  return {
    provider,
    threadId: id,
    root: current.current,
    primary: current.primary,
    assignment: explicit
      ? "explicit"
      : current.current !== current.primary
        ? "needs_host_evidence"
        : "primary",
    assignedRoot: explicit,
    assignmentKind: explicit ? assignmentKind : undefined,
    evidence: {
      cwd: current.current,
      launchRoot:
        provider === "claude"
          ? process.env.CLAUDE_PROJECT_DIR
          : provider === "cursor"
            ? process.env.ROOT_WORKTREE_PATH
            : undefined,
      t3Branch: t3?.branch,
    },
    message:
      "A linked path or branch name alone does not prove thread ownership. Pass an explicit current host assignment to ensure; retain the returned key.",
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      const flag = process.argv[i];
      const key = {
        "--provider": "provider",
        "--thread-id": "threadId",
        "--assigned-root": "assignedRoot",
        "--assignment-kind": "assignmentKind",
        "--cwd": "cwd",
      }[flag];
      if (flag === "--stdin") {
        options.payload = JSON.parse(fs.readFileSync(0, "utf8"));
        i--;
        continue;
      }
      if (!key || !process.argv[i + 1])
        throw new Error("Invalid context option.");
      options[key] = process.argv[i + 1];
    }
    process.stdout.write(`${JSON.stringify(context(options), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
