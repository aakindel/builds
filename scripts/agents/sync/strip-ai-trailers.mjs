#!/usr/bin/env node
/* Husky commit-msg hook body. Deletes AI co-author trailers from the message
   file Git passes as $1 and lets the commit continue. Human co-authors stay.
   A failure only warns: a missed trailer must never block a commit. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const commitMsgCommand =
  '[ ! -f scripts/agents/sync/strip-ai-trailers.mjs ] || node scripts/agents/sync/strip-ai-trailers.mjs "$1"';

function isAiTrailer(line) {
  const email = line.match(/^co-authored-by:.*<([^<>\s]*)>\s*$/i)?.[1];

  if (!email) return false;

  return (
    /@anthropic\.com$/i.test(email) || /^cursoragent@cursor\.com$/i.test(email)
  );
}

export function stripAiTrailers(message) {
  const lines = message.split("\n");
  const kept = lines.filter((line) => !isAiTrailer(line.replace(/\r$/, "")));

  if (kept.length === lines.length) return message;

  while (kept.length > 0 && kept.at(-1).trim() === "") kept.pop();

  return `${kept.join("\n")}\n`;
}

export function stripAiTrailersFile(file) {
  const message = fs.readFileSync(file, "utf8");
  const next = stripAiTrailers(message);

  if (next !== message) fs.writeFileSync(file, next);

  return next !== message;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const file = process.argv[2];

    if (!file) throw new Error("Usage: strip-ai-trailers.mjs COMMIT_MSG_FILE");
    stripAiTrailersFile(file);
  } catch (error) {
    process.stderr.write(
      `AI trailer strip skipped: ${error instanceof Error ? error.message : String(error)}\n`
    );
  }
}
