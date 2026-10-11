import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicJSON } from "../shared/agent-data.mjs";
import {
  publishSkills,
  recoverSkillsLock,
  skillsPlan,
  skillsReport,
  syncContext,
} from "./agent-skills-sync.mjs";

export function main(args = process.argv.slice(2)) {
  let root = process.cwd(),
    check = false,
    status = false,
    hook = false,
    recover = false,
    json = false;
  const expected = {};
  try {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--check") check = true;
      else if (arg === "--status") status = true;
      else if (arg === "--hook") hook = true;
      else if (arg === "--recover-lock") recover = true;
      else if (arg === "--json") json = true;
      else if (
        [
          "--project",
          "--expected-head",
          "--expected-source",
          "--expected-engine",
        ].includes(arg)
      ) {
        const value = args[++i];
        if (!value || value.startsWith("--"))
          throw new Error(`${arg} needs a value.`);
        if (arg === "--project") root = path.resolve(value);
        else
          expected[
            {
              "--expected-head": "expectedHead",
              "--expected-source": "expectedSource",
              "--expected-engine": "expectedEngine",
            }[arg]
          ] = value;
      } else throw new Error(`Unknown skills-sync argument: ${arg}`);
    }
    if ([check, status, recover].filter(Boolean).length > 1)
      throw new Error("Choose only one skills-sync inspection/recovery mode.");
    if (Object.keys(expected).length && Object.keys(expected).length !== 3)
      throw new Error(
        "A reviewed retry requires HEAD, source and engine fingerprints together."
      );
    if (
      Object.values(expected).some((value) => !/^[a-f0-9]{40,64}$/.test(value))
    )
      throw new Error(
        "Reviewed retry fingerprints must be hexadecimal digests."
      );
    const context = syncContext({ root, home: os.homedir() });
    let report;
    if (context.skipped) report = { status: "skipped", ...context };
    else if (recover) report = recoverSkillsLock(context);
    else if (check || status) {
      report = skillsReport(skillsPlan(context));
      if (status) {
        const previous = path.join(
          root,
          "zlocal/agent-skills-sync/status.json"
        );
        if (fs.existsSync(previous))
          report.previous = JSON.parse(fs.readFileSync(previous, "utf8"));
      }
    } else report = publishSkills(context, expected);
    if (json || !hook)
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else if (report.status !== "skipped")
      process.stderr.write(
        `Skills synchronization ${report.status}: ${report.changes?.length ?? 0} file changes, ${report.adoptions?.length ?? 0} identical copies adopted, ${report.blocked?.length ?? 0} blocked groups. Details: zlocal/agent-skills-sync/status.json\n`
      );
    if (!hook && ["pending", "stale"].includes(report.status))
      process.exitCode = 2;
    return report;
  } catch (error) {
    const report = {
      status: "pending",
      reason: "configuration",
      error: error.message,
    };
    if (!check && !status && !recover) {
      try {
        atomicJSON(
          path.join(root, "zlocal/agent-skills-sync/status.json"),
          report
        );
      } catch {
        /* Preserve the original error. */
      }
    }
    process.stderr.write(`Skills synchronization pending: ${error.message}\n`);
    if (!hook) process.exitCode = 1;
    return report;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
