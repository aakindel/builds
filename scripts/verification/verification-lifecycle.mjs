// Shell bridge. Only maintained launchers call this; it is not a browser adapter.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  browserStage,
  recordedResource,
  registerResource,
} from "./browser-session.mjs";
import {
  cleanupResources,
  phaseTimeouts,
  processIdentity,
  runOwned,
  sharedCleanupDeadline,
} from "./verification-process.mjs";

export const cleanupDeadline = () => sharedCleanupDeadline();
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [action, phase, ...args] = process.argv.slice(2);
  if (action === "stop") {
    const pid = Number(phase),
      identity =
        recordedResource(pid) ??
        processIdentity(pid, process.env.AGENT_BROWSER_TOKEN, "shell-child");
    if (!identity) {
      try {
        process.kill(pid, 0);
        process.exitCode = 1;
      } catch (error) {
        process.exitCode = error.code === "ESRCH" ? 0 : 1;
      }
    } else {
      const result = await cleanupResources([identity], {
        deadline: cleanupDeadline(),
        token: process.env.AGENT_BROWSER_TOKEN,
      });
      process.exitCode = result.cleanup === "dead" ? 0 : 1;
    }
  } else if (action === "resource") registerResource(Number(phase), args[0]);
  else if (action === "run" && phaseTimeouts[phase] && args.length) {
    browserStage(phase);
    const result = await runOwned(args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: phaseTimeouts[phase],
      shareCleanup: false,
      onOutput:
        phase === "convex-keygen"
          ? () => {}
          : (value) => process.stdout.write(value),
    });
    if (phase === "convex-keygen" && result.ok)
      process.stdout.write(result.output);
    if (!result.ok) {
      const error = new Error(
        `${phase} failed: ${result.error ?? result.output}; cleanup=${result.cleanup}`
      );
      browserStage(result.cleanup !== "dead" ? "cleanup" : phase, error);
      process.stderr.write(error.message + "\n");
      process.exitCode = 1;
    } else browserStage("convex-ready");
  } else throw new Error("Unsupported internal lifecycle action.");
}
