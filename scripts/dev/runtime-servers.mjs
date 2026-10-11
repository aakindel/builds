// runtime-servers-managed: 1

import path from "node:path";
import { fileURLToPath } from "node:url";
import readers from "./runtime-servers.cjs";

export const {
  ranges,
  validateOrigin,
  readAgentOwner,
  readAgentBaseURL,
  inspectListeners,
  findOwnedDevPort,
  assertNoNextProcess,
  assertNoProjectServers,
  findFreePort,
  readE2eEnvironment,
  waitForE2e,
} = readers;

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, root = process.cwd(), first, second] = process.argv.slice(2);
  try {
    if (command === "agent-url")
      process.stdout.write(`${readAgentBaseURL(root)}\n`);
    else if (command === "agent-stop-token")
      process.stdout.write(
        readAgentOwner(root, [Number(first), Number(second)]).token
      );
    else if (command === "dev-port")
      process.stdout.write(
        String(
          findOwnedDevPort(root, {
            start: Number(first),
            end: Number(second),
          }) ?? ""
        )
      );
    else if (command === "no-next-process") assertNoNextProcess(root);
    else if (command === "validate-e2e") readE2eEnvironment(root);
    else if (command === "free-port")
      process.stdout.write(String(findFreePort(Number(first), Number(second))));
    else if (command === "wait-e2e") {
      const reportStage = process.env.AGENT_BROWSER_STAGE_FILE
        ? (await import("../verification/browser-session.mjs")).browserStage
        : undefined;
      await waitForE2e(root, Number(first), { reportStage });
    } else throw new Error("Unknown runtime-server command.");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
