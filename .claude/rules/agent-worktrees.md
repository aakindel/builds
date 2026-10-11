<!-- Generated from .agents/rules. Do not edit. Run pnpm agents:rules. -->

Before implementation, use /agent-worktrees before per-turn writing helpers.
Resolve the helper at scripts/agents/worktrees/agent-worktrees.mjs first, then
scripts/agent-worktrees.mjs for an existing flat installation. Use that actual
path even when a loaded personal skill still shows the older layout.
Primary zlocal/dev-config.json supplies WORKTREES_MODE off/local/remote and
REMOTE_CHECKS. Explicit initial user mode instructions override config; an
explicit current harness assignment overrides both. Never infer ownership from
a path or branch prefix. Retain key, owner, root, branch, workflow and completion
policy across resume, compaction and config changes. Errors never permit fallback
to primary.

Use the returned root for all edits and commands. Translate mentioned primary
paths. Declare task scope, inspect advisory overlaps, and stop on ownership
conflicts or known incompatible changes. Main mode permits one participating
implementation writer. Finish releases activity, not the binding. Interrupted
claims require reliable host evidence or inspected explicit recovery, never age
or helper PID expiry. These instructions are not an OS filesystem boundary.

Native checkouts retain their host branch and dirty baseline. Never create a
nested worktree, stage inherited dirty files automatically, or run helper cleanup
on them. T3 worktrees bind with `--provider t3`, using T3's thread record as
evidence, and `/merge-worktree` may merge and remove them. Remote mode is a local checkout from a refreshed remote target. Missing
remote commits or dirty primary files require user confirmation to carry them,
or a verified refetch after the user pushes. Approved carry saves a baseline in
the new checkout while preserving primary files and staging.

Use /agent-commit only on request. Helper local mode integrates saved commits
with checked safeguards. Native mode hands back to the host. Remote mode reports
PR-ready; push and PR create/update require explicit instruction. Explicit local
integration respects host permissions. Cleanup is explicit and preserves pending
work. Remote cleanup requires matching merged PR evidence, including squash or
rebase merges. Stop owned servers and release this thread's claim before finish.
