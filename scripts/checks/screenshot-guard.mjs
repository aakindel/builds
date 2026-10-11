#!/usr/bin/env node
// Pre-commit guard: a staged demo change must ship with screenshots taken from
// that exact source. Reads the git index directly, so lint-staged's file list
// (which omits deletions) only decides whether this runs.
//
// Bypass for one commit with SKIP_SCREENSHOT_GUARD=1.
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectState,
  findProblems,
  MANIFEST_PATH,
  readHeadManifest,
  readIndexListing,
  readStagedChanges,
  readStagedManifest,
  shotPath,
  touchedKeys,
} from "./demo-screenshots-lib.mjs";

const DESCRIPTIONS = {
  stale: "demo changed since its screenshots were taken",
  uncaptured: "demo has no manifest entry",
  "missing-shot": "screenshot missing",
  "orphan-shot": "screenshot has no demo",
  "orphan-entry": "manifest entry has no demo",
};

/** Problems limited to the demos this commit touches. */
export function checkStaged(root) {
  const changes = readStagedChanges(root);
  if (changes.length === 0) return [];
  const staged = readStagedManifest(root);
  const keys = touchedKeys(changes, readHeadManifest(root), staged);
  if (keys.size === 0) return [];
  const state = collectState(readIndexListing(root));
  return findProblems(state, staged).filter((problem) => keys.has(problem.key));
}

export function formatProblems(problems) {
  const lines = [
    "Demo screenshots are out of date for this commit:",
    "",
    ...problems.map((problem) => {
      const target = problem.theme
        ? shotPath(problem.key, problem.theme)
        : problem.key;
      return `  - ${target}: ${DESCRIPTIONS[problem.kind]}`;
    }),
    "",
    "Fix: pnpm screenshots:update",
    `Then stage public/demos and ${MANIFEST_PATH}.`,
    "If the change cannot affect any pixels and you are sure, bypass once with SKIP_SCREENSHOT_GUARD=1.",
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  if (process.env.SKIP_SCREENSHOT_GUARD === "1") {
    process.stdout.write(
      "Screenshot guard skipped (SKIP_SCREENSHOT_GUARD=1).\n"
    );
    return;
  }
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );
  const problems = checkStaged(root);
  if (problems.length === 0) return;
  process.stderr.write(formatProblems(problems));
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
