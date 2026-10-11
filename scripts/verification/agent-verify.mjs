// A single parent owns server and verification children in one network namespace.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicJSON, safePath } from "../agents/shared/agent-data.mjs";
import { readAgentBaseURL, readAgentOwner } from "../dev/runtime-servers.mjs";
import { browserStage } from "./browser-session.mjs";

export function verificationCommand(root, operation, args = []) {
  if (operation === "browser" && args.length === 0)
    return [process.execPath, "scripts/verification/browser-preflight.mjs"];
  if (["agent", "alignment"].includes(operation)) {
    for (const file of args) {
      if (!/^e2e\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.spec\.ts$/.test(file))
        throw new Error(
          "Only explicit e2e/*.spec.ts selections are allowed; config and environment overrides are rejected."
        );
      if (!fs.statSync(safePath(root, file)).isFile())
        throw new Error("Test selection must be a regular file.");
    }
    return [
      path.join(root, "node_modules/.bin/playwright"),
      "test",
      `--config=playwright.${operation}.config.ts`,
      ...args,
    ];
  }
  if (operation === "screenshot" && args.length === 2) {
    const [route, output] = args;
    if (
      !route.startsWith("/") ||
      route.startsWith("//") ||
      /[\\\r\n]/.test(route)
    )
      throw new Error(
        "Screenshot needs a relative route on the owned agent origin."
      );
    if (
      !/^zlocal\/artifacts\/screenshots\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.webp$/.test(
        output
      )
    )
      throw new Error(
        "Screenshot output must be a WebP under zlocal/artifacts/screenshots."
      );
    safePath(root, output);
    return [
      process.execPath,
      "--experimental-strip-types",
      "scripts/verification/screenshot.ts",
      route,
      "--out",
      output,
    ];
  }
  throw new Error(
    "Choose browser, agent, alignment, or screenshot with its bounded arguments."
  );
}

export async function verify(root, operation, args = []) {
  const command = verificationCommand(root, operation, args);
  const pendingFile = path.join(
    root,
    "zlocal/artifacts/agent-verify/cleanup-pending.json"
  );
  if (fs.existsSync(pendingFile)) {
    const pending = JSON.parse(fs.readFileSync(pendingFile));
    const live = pending.pids.filter((pid) => {
      if (!Number.isInteger(pid) || pid <= 0)
        throw new Error(
          "Invalid pending child record; inspect before retrying."
        );
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        if (error.code === "ESRCH") return false;
        return true;
      }
    });
    if (live.length)
      throw new Error(
        `Prior verification children need inspected cleanup: ${live.join(", ")}`
      );
    fs.rmSync(pendingFile);
  }
  if (fs.existsSync(path.join(root, "zlocal/.agent-owner.json")))
    throw new Error(
      "An agent server is already recorded. Stop or inspect it before this owned run."
    );
  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: "0",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const key of [
    "PORT",
    "AGENT_PORT_START",
    "AGENT_PORT_END",
    "NODE_PATH",
    "NEXT_E2E",
    "E2E_BASE_URL",
    "E2E_ROOT",
    "E2E_RUN_ID",
    "E2E_LAUNCHER_PID",
  ])
    delete env[key];
  if (env.AGENT_VERIFIED_PORT) {
    if (!/^(310[0-9]|3110)$/.test(env.AGENT_VERIFIED_PORT))
      throw new Error("Invalid host-selected agent port.");
    env.PORT = env.AGENT_VERIFIED_PORT;
  }
  // Discard arbitrary caller startup code; retain only the maintained observer.
  if (
    env.AGENT_BROWSER_TOKEN &&
    env.AGENT_BROWSER_STAGE_FILE &&
    env.AGENT_BROWSER_ROOT === root
  )
    env.NODE_OPTIONS = `--import ${JSON.stringify(path.join(root, "scripts/verification/browser-spawn-tracker.mjs"))}`;
  else delete env.NODE_OPTIONS;
  const children = new Set();
  let interrupted = false;
  const launch = (executable, argv) => {
    const child = spawn(executable, argv, { cwd: root, env, stdio: "inherit" });
    children.add(child);
    child.completion = new Promise((resolve) => {
      child.once("error", (error) => {
        child.spawnError = error;
        children.delete(child);
        resolve({ error });
      });
      child.once("close", (code, signal) => {
        children.delete(child);
        resolve({ code, signal });
      });
    });
    return child;
  };
  const interrupt = () => {
    interrupted = true;
    for (const child of children) child.kill("SIGTERM");
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const server = launch("/bin/bash", ["scripts/dev/agent-dev.sh"]);
  browserStage("server-start");
  let outcome;
  let failure;
  try {
    const deadline = Date.now() + 180000;
    let ready = false;
    while (Date.now() < deadline) {
      if (interrupted)
        throw new Error(
          "Verification interrupted; cleaning up owned children."
        );
      if (server.spawnError) throw server.spawnError;
      if (server.exitCode !== null || server.signalCode)
        throw new Error("Owned agent server exited during startup.");
      try {
        const owner = readAgentOwner(root);
        if (owner.wrapperPid !== server.pid)
          throw new Error("Another wrapper owns the agent record.");
        const response = await fetch(
          `${readAgentBaseURL(root)}/api/verification-health`,
          { redirect: "error", signal: AbortSignal.timeout(2000) }
        );
        const health = await response.json();
        if (
          response.ok &&
          health.root === root &&
          health.role === "agent" &&
          health.runId === owner.runId
        ) {
          ready = true;
          break;
        }
      } catch (error) {
        if (error.message === "Another wrapper owns the agent record.")
          throw error;
        if (["EPERM", "EACCES"].includes(error.cause?.code ?? error.code)) {
          const failure = new Error(
            `Owned localhost health probe was blocked (${error.cause?.code ?? error.code}).`,
            { cause: error }
          );
          browserStage("localhost", failure);
          throw failure;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready)
      throw new Error(
        "Owned agent server did not become ready within 180 seconds."
      );
    browserStage("next-ready", undefined, "next");
    if (interrupted) throw new Error("Verification interrupted.");
    const worker = launch(command[0], command.slice(1));
    const result = await worker.completion;
    if (result.error) throw result.error;
    if (result.code !== 0)
      throw new Error(`Verification failed (${result.code ?? result.signal}).`);
    outcome = { operation, passed: true };
  } catch (error) {
    failure = error;
  } finally {
    interrupt();
    try {
      await Promise.all(
        [...children].map(async (child) => {
          let timer;
          try {
            await Promise.race([
              child.completion,
              new Promise((_, reject) => {
                timer = setTimeout(() => {
                  child.kill("SIGKILL");
                  child.unref();
                  reject(
                    new Error(
                      `Owned child ${child.pid} did not exit; pending cleanup was retained.`
                    )
                  );
                }, 15000);
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        })
      );
    } catch (error) {
      atomicJSON(pendingFile, {
        root,
        pids: [...children].map((child) => child.pid),
        error: error.message,
      });
      failure = failure
        ? new AggregateError(
            [failure, error],
            `${failure.message}; ${error.message}`
          )
        : error;
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
  }
  if (failure) throw failure;
  return outcome;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fs.realpathSync(path.resolve(import.meta.dirname, "../.."));
  verify(root, process.argv[2], process.argv.slice(3)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
