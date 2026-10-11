/* Shared extractors for local/no-unknown-css-vars.
   Assignment = this repo sets the custom property.
   Use = a class string reads it via var() or Tailwind (--token) / (type:--token). */

export const DEFAULT_IGNORE_PREFIXES = [
  "--toast-",
  "--tw-",
  "--font-",
  /* Base UI popup/positioner runtime vars */
  "--anchor-",
  "--available-",
  "--transform-",
  /* Base UI tabs indicator runtime vars */
  "--active-tab-",
];

const CSS_VAR = "--[a-zA-Z0-9-]+";

const ASSIGNMENT_PATTERNS = [
  /* CSS / @theme / :root: `--name:` — not `var(--name)` (no colon). */
  new RegExp(`(?:^|[\\s;{])(${CSS_VAR})\\s*:`, "gm"),
  /* Tailwind arbitrary property: `[--name:…]` */
  new RegExp(`\\[(${CSS_VAR}):`, "g"),
  /* React style object: `"--name":` / `'--name':` */
  new RegExp(`['"](${CSS_VAR})['"]\\s*:`, "g"),
];

const VAR_USE = new RegExp(`var\\(\\s*(${CSS_VAR})`, "g");
/* `(--name)` or `(image:--name)` — not `--spacing(3)` (no closing paren after the name). */
const PAREN_USE = new RegExp(`\\((?:[a-z][a-z0-9-]*:)?(${CSS_VAR})\\)`, "g");

export function extractAssignments(text) {
  const names = new Set();
  for (const pattern of ASSIGNMENT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return names;
}

export function findUses(text) {
  const uses = [];
  const seen = new Set();

  function add(name, index) {
    const key = `${index}:${name}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uses.push({ name, index });
  }

  VAR_USE.lastIndex = 0;
  for (const match of text.matchAll(VAR_USE)) {
    add(match[1], match.index + match[0].lastIndexOf(match[1]));
  }

  PAREN_USE.lastIndex = 0;
  for (const match of text.matchAll(PAREN_USE)) {
    if (
      match.index >= 3 &&
      text.slice(match.index - 3, match.index) === "var"
    ) {
      continue;
    }
    add(match[1], match.index + match[0].lastIndexOf(match[1]));
  }

  return uses;
}

export function isIgnored(name, prefixes) {
  return prefixes.some((prefix) => name.startsWith(prefix));
}
