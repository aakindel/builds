# Agent setup

The rules in `.agents/rules` use personal installed skills. Install agent-worktrees,
agent-isolation, general-fix, general-grill and general-writing in your agent
provider's skill directory. Skills are not vendored in this project.

Local settings belong in ignored `zlocal/dev-config.json`. Defaults are:

```json
{
  "DEV_DEPTH": "shallow",
  "DEV_DEPTH_LOG_RUNS": false,
  "WORKTREES_MODE": "off",
  "REMOTE_CHECKS": false,
  "WORKTREES_REMOTE": "origin",
  "WORKTREES_REMOTE_BRANCH": "main"
}
```

Depth and worktree helpers initialize their own missing settings. Explicit values
and unrelated keys survive updates. Shallow retains static checks and focused
tests; deep adds applicable agent verification. Invalid depth settings at turn
startup produce a warning and fall back to shallow with logging off. Installers
reject malformed settings before writing.

Worktrees are available through `pnpm worktrees`. Off keeps work in the primary
checkout. Local and remote routing are opt-in; remote routing needs the chosen
remote branch. Cursor's setup command prepares an explicitly assigned native
worktree. Installing the feature creates no task worktree or ownership claim.

Environment support is browser-only by default. Managed runtime, cloud and host
preparation are optional features installed separately. Playwright and Chromium
are optional too. Before browser verification, run:

```sh
pnpm add -D @playwright/test
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
pnpm agents:browser run browser
```

Browser verification owns and cleans up its isolated agent server. Missing
prerequisites stop before server launch. Agent/alignment operations need their
matching Playwright config and explicit checked-in specs; screenshot needs its
script; e2e needs its runner and config. Install those adapters separately.
Use `pnpm dev:agent` for agent servers and stop them before finishing.

The raw starter's local recipe marker lives at
`zlocal/syscrypt/create-raw-project.json`. It is not committed. The eleven-commit
runner refuses older recipes, mismatched markers and unrelated Git history.
