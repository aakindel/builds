// Shared mapping between demo folders, their preview screenshots and the
// screenshots manifest. Used by the pre-commit guard and `pnpm screenshots:update`.
//
// A demo is any folder with files under `<tree>/<section>/demos/<slug>/`, or
// `<tree>/demos/<slug>/` for a flat tree. Its shots are
// `public/<route>-{light,dark}.webp`, with matching `-mini.webp` derivatives.
// The manifest records a hash of
// the demo folder's git blob IDs at capture time, so a recapture that changes
// no pixels still proves the shots were taken from the current source.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MANIFEST_PATH = "screenshots.manifest.json";
export const THEMES = /** @type {const} */ (["light", "dark"]);

export const DEMO_TREES = [
  { appDir: "app/(pages)", route: "", layout: "flat" },
];

/** Path from a tree root to a demo folder, by tree layout. */
const DEMO_PATHS = {
  sectioned: "[^/]+/demos/[^/]+",
  flat: "demos/[^/]+",
};

export const PATHSPECS = [
  ...DEMO_TREES.map((tree) => tree.appDir),
  ...DEMO_TREES.map((tree) => `public/${tree.route || "demos"}`),
];

const IGNORED_NAMES = new Set([".DS_Store"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEMO_FILE_PATTERNS = DEMO_TREES.map((tree) => ({
  route: tree.route,
  pattern: new RegExp(
    `^${escapeRegExp(tree.appDir)}/(${DEMO_PATHS[tree.layout]})/(.+)$`
  ),
}));

const SHOT_PATTERNS = DEMO_TREES.map((tree) => ({
  route: tree.route,
  pattern: new RegExp(
    `^public/${tree.route ? escapeRegExp(tree.route) + "/" : ""}(${DEMO_PATHS[tree.layout]})-(${THEMES.join("|")})(-mini)?\\.webp$`
  ),
}));

/** The standalone route key for a file inside a demo folder. */
export function demoKeyOf(file) {
  if (IGNORED_NAMES.has(path.posix.basename(file))) return null;
  for (const { route, pattern } of DEMO_FILE_PATTERNS) {
    const match = pattern.exec(file);
    if (match) return `${route ? route + "/" : ""}${match[1]}`;
  }
  return null;
}

/** `{ key, theme }` for a demo screenshot path, or null. */
export function shotOf(file) {
  for (const { route, pattern } of SHOT_PATTERNS) {
    const match = pattern.exec(file);
    if (match)
      return {
        key: `${route ? route + "/" : ""}${match[1]}`,
        theme: match[2] + (match[3] ?? ""),
      };
  }
  return null;
}

export function shotPath(key, theme) {
  return `public/${key}-${theme}.webp`;
}

export function demoDir(key) {
  if (!/^demos\/[^/]+$/.test(key)) {
    throw new Error(`Unknown demo route: ${key}`);
  }
  const tree = DEMO_TREES[0];
  const rest = key.split("/");
  return `${tree.appDir}/${rest.join("/")}`;
}

export function demoRoute(key) {
  return `/${key}`;
}

/** Order-independent hash of a demo folder's `[path, blobId]` pairs. */
export function hashDemo(entries) {
  const hash = crypto.createHash("sha256");
  for (const [file, blob] of [...entries].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    hash.update(`${file}\0${blob}\n`);
  }
  return hash.digest("hex");
}

/**
 * Group a `path → blobId` listing into demo hashes and screenshot themes.
 * @param {Map<string, string>} listing
 */
export function collectState(listing) {
  const demoFiles = new Map();
  const shots = new Map();
  for (const [file, blob] of listing) {
    const key = demoKeyOf(file);
    if (key) {
      if (!demoFiles.has(key)) demoFiles.set(key, []);
      demoFiles.get(key).push([file, blob]);
      continue;
    }
    const shot = shotOf(file);
    if (shot) {
      if (!shots.has(shot.key)) shots.set(shot.key, new Set());
      shots.get(shot.key).add(shot.theme);
    }
  }
  const demos = new Map(
    [...demoFiles].map(([key, entries]) => [key, hashDemo(entries)])
  );
  return { demos, shots };
}

/**
 * Every way the shots and manifest disagree with the demo folders.
 * @param {{ demos: Map<string, string>, shots: Map<string, Set<string>> }} state
 * @param {Record<string, string>} manifest
 */
export function findProblems(state, manifest) {
  const problems = [];
  for (const [key, hash] of state.demos) {
    if (manifest[key] !== hash) {
      problems.push({
        kind: manifest[key] ? "stale" : "uncaptured",
        key,
      });
    }
    for (const theme of THEMES.flatMap((theme) => [theme, `${theme}-mini`])) {
      if (!state.shots.get(key)?.has(theme)) {
        problems.push({ kind: "missing-shot", key, theme });
      }
    }
  }
  for (const [key, themes] of state.shots) {
    if (state.demos.has(key)) continue;
    for (const theme of themes) {
      problems.push({ kind: "orphan-shot", key, theme });
    }
  }
  for (const key of Object.keys(manifest)) {
    if (!state.demos.has(key)) problems.push({ kind: "orphan-entry", key });
  }
  return problems;
}

/** Demo keys a list of changed paths touches, including manifest edits. */
export function touchedKeys(files, manifestBefore = {}, manifestAfter = {}) {
  const keys = new Set();
  for (const file of files) {
    const key = demoKeyOf(file) ?? shotOf(file)?.key;
    if (key) keys.add(key);
  }
  if (files.includes(MANIFEST_PATH)) {
    for (const key of new Set([
      ...Object.keys(manifestBefore),
      ...Object.keys(manifestAfter),
    ])) {
      if (manifestBefore[key] !== manifestAfter[key]) keys.add(key);
    }
  }
  return keys;
}

export function parseManifest(text, source = MANIFEST_PATH) {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON object of demo key to hash.`);
  }
  return parsed;
}

export function formatManifest(manifest) {
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((key) => [key, manifest[key]])
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

function git(root, args, input) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Staged `path → blobId` for the demo trees and screenshot folders. */
export function readIndexListing(root) {
  const listing = new Map();
  const output = git(root, ["ls-files", "-s", "-z", "--", ...PATHSPECS]);
  for (const record of output.split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [, blob] = record.slice(0, tab).split(" ");
    listing.set(record.slice(tab + 1), blob);
  }
  return listing;
}

/**
 * Working-tree `path → blobId` for the same paths, tracked and untracked but
 * not ignored. Blob IDs match what `git add` would stage.
 */
export function readWorktreeListing(root) {
  const files = git(root, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...PATHSPECS,
  ])
    .split("\0")
    .filter(
      (file) =>
        file &&
        (demoKeyOf(file) || shotOf(file)) &&
        fs.existsSync(path.join(root, file))
    );
  const unique = [...new Set(files)];
  if (unique.length === 0) return new Map();
  const blobs = git(
    root,
    ["hash-object", "--stdin-paths"],
    `${unique.join("\n")}\n`
  )
    .trim()
    .split("\n");
  return new Map(unique.map((file, index) => [file, blobs[index]]));
}

export function readStagedManifest(root) {
  try {
    return parseManifest(
      git(root, ["show", `:${MANIFEST_PATH}`]),
      `staged ${MANIFEST_PATH}`
    );
  } catch (error) {
    if (error instanceof SyntaxError) throw error;
    return {};
  }
}

export function readHeadManifest(root) {
  try {
    return parseManifest(git(root, ["show", `HEAD:${MANIFEST_PATH}`]));
  } catch (error) {
    if (error instanceof SyntaxError) throw error;
    return {};
  }
}

export function readWorktreeManifest(root) {
  const file = path.join(root, MANIFEST_PATH);
  if (!fs.existsSync(file)) return {};
  return parseManifest(fs.readFileSync(file, "utf8"));
}

/** Staged paths, including deletions and both sides of renames. */
export function readStagedChanges(root) {
  return git(root, [
    "diff",
    "--cached",
    "--name-only",
    "--no-renames",
    "-z",
    "--",
    ...PATHSPECS,
    MANIFEST_PATH,
  ])
    .split("\0")
    .filter(Boolean);
}
