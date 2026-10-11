# Builds

UI demos and layouts. The home page links to each demo and its source on GitHub.

## Development

Install dependencies with `pnpm install`, then use `pnpm dev` for local development. Agent verification uses `pnpm dev:agent` and stops with `pnpm dev:agent:stop`.

## Demo previews

Run `PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium` once. Run `pnpm screenshots:update` after changing a demo. It captures light and dark previews, generates mini thumbnails, and updates `screenshots.manifest.json`. Stage all four images and the manifest with the demo. The commit guard checks their source hashes. Shared style changes require `pnpm screenshots:update --all`.

## Checks

Run `pnpm exec tsc --noEmit --skipLibCheck`, `pnpm typecheck:agents`, `node --test scripts/checks/demo-screenshots-lib.test.mjs`, and `pnpm build`.

## Source

Demo folders come from the committed ui-library AAK snapshot. `__docs__/source-snapshot.json` records the source commit and file hashes. Each demo lands with its index entry and fresh previews in its own commit.
