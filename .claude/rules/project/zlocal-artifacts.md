<!-- Generated from .agents/rules. Do not edit. Run pnpm agents:rules. -->

# Agent scratch → `zlocal/artifacts/`

`zlocal/` is gitignored local scratch. **Do not dump misc agent files at `zlocal/` root.**

## Where agent work goes

Write screenshots, comparison images, analysis scripts, throwaway helpers, ephemeral build shots, and similar misc artifacts under **`zlocal/artifacts/`** (create the folder lazily if needed).

Examples:

```text
zlocal/artifacts/badge-compare-dark.png
zlocal/artifacts/oklch-candidate.mjs
zlocal/artifacts/<slug>-build-shots/live_full.png
```

Prefer a short topic subfolder when a task produces several related files (e.g. `zlocal/artifacts/<slug>-build-shots/`).

## Durable environment documentation

Temporary artifacts may be cleared regularly. Durable environment status and necessary supporting evidence belong under `__docs__/environment/`. Keep dated verification summaries and useful commands inline in the status document. Preserve a separate log, screenshot or report only when future diagnosis needs it, review it for sensitive or unnecessary machine-specific content, and use relative links.

Do not make that documentation depend on files under `zlocal/`. Remove references to unnecessary artifacts instead of copying them into documentation. Before finishing, resolve the status document's links with `zlocal/` excluded; do not delete live scratch or infrastructure to perform this check. Documentation must retain its results and unresolved limits after disposable outputs are cleared.

## What stays at `zlocal/` root (or dedicated infra paths)

Do **not** move or reinvent these:

| Kind                                   | Examples                                                |
| -------------------------------------- | ------------------------------------------------------- |
| Agent ownership control                | `.agent-owner.json`, `.agent-start.lock`, `.agent-stop` |
| Local workflow config                  | `dev-config.json`                                       |
| User personal notes                    | `chat.md`, `notes.md`, `prompts.md`, `ui.md`            |
| Named skill outputs already namespaced | `zlocal/handoffs/`, `zlocal/ica-reports/`               |

## Red flags

Retired `dev-depth.json` backups belong under
`zlocal/artifacts/dev-depth-migrations/`. They are migration archives, not active
workflow config.

- Writing loose `*.png`, `*.mjs`, `*.html`, or similar at `zlocal/` root
- Putting ownership controls, workflow config or user notes under `zlocal/artifacts/`
- Writing agent scratch under tracked paths (`__docs__/`, `app/`, `.agents/`, etc.) when `zlocal/artifacts/` is appropriate
