<!-- agent-rules-start -->

<!-- Generated from .agents/rules. Do not edit. Run pnpm agents:rules. -->

## Agent Rules

Codex loads this index, not the linked `.mdc` files. Before work, read every always-applied rule body, then follow it for the rest of the session. Cursor also loads the `.mdc` files directly.

Keep rule bodies in `.agents/rules`. Codex concatenates project instruction files (`AGENTS.md`, nested `AGENTS.override.md`) into one chain capped at 32 KiB by default (`project_doc_max_bytes`). Inlining those bodies would consume that budget. Files the agent reads from the links do not.

### Always applied

- [general-fix](/.agents/rules/general-fix.mdc) — After Tailwind class edits or changes that affect types, use /general-fix. Run canonical classes, applicable edited-file ESLint, then the full typecheck in that order.
- [grill](/.agents/rules/grill.mdc) — Grill ambiguous requirements before building. Use /general-grill when scope, behavior, or success criteria are unclear. Skip when requirements are already concrete. After all remaining relevant grill questions are asked and answered, post ASSUMPTIONS I'M MAKING and wait. If no questions were asked, skip assumptions.
- [zlocal-artifacts](/.agents/rules/project/zlocal-artifacts.mdc) — Put agent scratch (screenshots, one-off scripts, build shots) under zlocal/artifacts/, never loose in zlocal/. Durable environment evidence belongs in `__docs__/environment/`. Infrastructure and user notes stay at zlocal/ root.
- [questions](/.agents/rules/questions.mdc) — Ask questions as plain chat text, not Cursor's AskQuestion tool, Claude's AskUserQuestion tool, or Codex's request_user_input tool. User questions are read-only: answer in chat and do not edit files.
- [ui-library](/.agents/rules/ui-library.mdc) — Reuse existing ui-library components and layouts before building new UI. Use when creating or refactoring components, layouts, page shells, dialogs, tables, sidebars, forms, navigation, command palettes, querybuilders, toasts, sheets, tabs, or similar elements.
- [writing](/.agents/rules/writing.mdc) — Cut AI tells from any writing. Use /general-writing on chat replies, docs, skills, rules, and other prose.

<!-- agent-rules-end -->
