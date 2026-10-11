import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { extractAssignments } from "./css-vars.mjs";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-agent",
  "out",
  "build",
  ".source",
  "dist",
  "coverage",
  "__docs__",
  "zlocal",
  "(_archive)",
]);

const SOURCE_EXTS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".mjs"]);

const CACHE_TTL_MS = 2000;

/** @type {{ cwd: string, at: number, names: Set<string> } | null} */
let cache = null;

export function resetCssVarIndexCache() {
  cache = null;
}

function shouldSkipFile(name) {
  return name.includes(".test.");
}

function collectSourceFiles(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      collectSourceFiles(join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile() || shouldSkipFile(entry.name)) {
      continue;
    }
    if (SOURCE_EXTS.has(extname(entry.name))) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

function addAssignmentsFromText(text, names) {
  for (const name of extractAssignments(text)) {
    names.add(name);
  }
}

/* Tailwind's default @theme lives in the installed package, not in app source.
   Resolve from cwd so pnpm's nested node_modules still work. */
function addTailwindDefaultTheme(cwd, names) {
  try {
    const require = createRequire(join(cwd, "package.json"));
    const themePath = join(
      dirname(require.resolve("tailwindcss/package.json")),
      "theme.css"
    );
    addAssignmentsFromText(readFileSync(themePath, "utf8"), names);
  } catch {
    /* tailwindcss is not installed */
  }
}

function crawlAssignments(cwd) {
  const names = new Set();
  addTailwindDefaultTheme(cwd, names);
  for (const file of collectSourceFiles(cwd, [])) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    addAssignmentsFromText(text, names);
  }
  return names;
}

export function getKnownCssVars(cwd) {
  const now = Date.now();
  if (cache && cache.cwd === cwd && now - cache.at < CACHE_TTL_MS) {
    return cache.names;
  }
  const names = crawlAssignments(cwd);
  cache = { cwd, at: now, names };
  return names;
}
