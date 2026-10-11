import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function validatePush(root, remote, input) {
  for (const line of input.trim().split("\n").filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4)
      throw new Error("Cannot inspect malformed push input.");
    const [, local, , previous] = parts;
    if (
      !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(local) ||
      !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(previous)
    )
      throw new Error("Invalid push object IDs.");
    if (/^0+$/.test(local)) continue; // Deleting a ref introduces no commits.
    const args = /^0+$/.test(previous)
      ? [local, "--not", `--remotes=${remote}`]
      : [`${previous}..${local}`];
    const result = spawnSync("git", ["log", "--format=%s", ...args, "--"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        "Cannot inspect the outgoing commit range. Fetch missing history and retry; nothing was approved."
      );
    if (result.stdout.split("\n").includes("interim commit"))
      throw new Error(
        "Push rejected: outgoing history contains 'interim commit'."
      );
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    validatePush(
      process.cwd(),
      process.argv[2] ?? "origin",
      fs.readFileSync(0, "utf8")
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
