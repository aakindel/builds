import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeResource,
  processIdentity,
  readEvents,
} from "./verification-process.mjs";

export const browserTimeouts = Object.freeze({
  sandbox: 30_000,
  reviewed: 60_000,
  cleanup: 20_000,
});
let sequence = 0;
function output(suffix) {
  const file = process.env.AGENT_BROWSER_STAGE_FILE;
  if (!file) return null;
  const root = fs.realpathSync(process.env.AGENT_BROWSER_ROOT ?? process.cwd());
  if (
    !/^zlocal\/artifacts\/browser-workflow\/[a-f0-9-]{36}\/(?:attempt-[12]|preparation-[123])\.json$/.test(
      path.relative(root, path.resolve(file))
    )
  )
    throw new Error("Invalid browser event output.");
  for (
    let current = path.dirname(file);
    current !== root;
    current = path.dirname(current)
  )
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error("Browser event output has a symlink ancestor.");
  const target = suffix ? file.replace(/\.json$/, suffix) : file;
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
    throw new Error("Browser event output must not be a symlink.");
  return target;
}
export function describeFailure(error) {
  if (!error) return undefined;
  const cause = error.cause ? describeFailure(error.cause) : undefined;
  const text = String(error.message ?? error).replace(
    /(--(?:admin-key|instance-secret)(?:=|\s+))[^\s]+/g,
    "$1[redacted]"
  );
  return {
    message: text + (cause ? "; " + cause.message : ""),
    code: error.code ?? cause?.code,
    cause,
  };
}
export function browserStage(
  phase,
  error,
  /* next-ready shares the next component with the phases it ends, as
     convex-ready does with the convex phases. The supervisor keeps one
     deadline clock per process and component, so a ready stage under another
     component would leave server-start or localhost running. */
  component = phase.startsWith("convex-")
    ? "convex"
    : ["server-start", "localhost", "next-ready"].includes(phase)
      ? "next"
      : "chromium"
) {
  const file = output(".events.jsonl");
  if (!file) return;
  fs.appendFileSync(
    file,
    JSON.stringify({
      version: 2,
      run: process.env.AGENT_BROWSER_RUN_ID,
      attempt: process.env.AGENT_BROWSER_ATTEMPT,
      pid: Number(process.env.AGENT_BROWSER_EVENT_PROCESS ?? process.pid),
      component,
      sequence: ++sequence,
      phase,
      at: Date.now(),
      error: describeFailure(error),
      fatal: !(
        ["convex-export", "convex-import"].includes(phase) &&
        process.env.AGENT_BROWSER_OPTIONAL_PHASE === "1"
      ),
    }) + "\n",
    { mode: 0o600 }
  );
}
export function recordBrowserProcess(record) {
  const file = output(".processes.jsonl");
  if (!file) return;
  fs.appendFileSync(file, JSON.stringify(record) + "\n", { mode: 0o600 });
}
export function recordedResource(pid) {
  const file = output(".processes.jsonl");
  if (!file) return null;
  return readEvents(file, { live: true })
    .filter(
      (item) =>
        item.type === "resource" &&
        item.identity?.pid === pid &&
        item.identity.token === process.env.AGENT_BROWSER_TOKEN
    )
    .reduce((result, item) => mergeResource(result, item.identity), null);
}
export function registerResource(pid, role) {
  let identity = processIdentity(pid, process.env.AGENT_BROWSER_TOKEN, role);
  if (!identity) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") {
        recordBrowserProcess({ type: "gone", pid, role });
        return undefined;
      }
    }
    throw new Error("Cannot retain process identity for " + role);
  }
  identity = mergeResource(recordedResource(pid), identity);
  recordBrowserProcess({ type: "resource", identity });
  return identity;
}
export function launchBlocked() {
  const file = output(".events.jsonl");
  if (!file || !fs.existsSync(file)) return false;
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .some((line) => {
      const event = JSON.parse(line);
      return (
        event.error &&
        ["chromium-launch", "convex-start", "server-start"].includes(
          event.phase
        )
      );
    });
}
export async function launchBrowser(chromium) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  if (launchBlocked())
    throw new Error(
      "A prior native launch failure blocks further launches in this attempt."
    );
  browserStage("chromium-launch");
  try {
    const browser = await chromium.launch({
      headless: true,
      timeout:
        process.env.AGENT_BROWSER_ROUTE === "reviewed"
          ? browserTimeouts.reviewed
          : browserTimeouts.sandbox,
    });
    browserStage("fixtures");
    return browser;
  } catch (error) {
    browserStage("chromium-launch", error);
    throw error;
  }
}
export async function closeBrowser(browser) {
  browserStage("cleanup");
  let timer;
  try {
    const limit = Math.max(
      1,
      Math.min(
        browserTimeouts.cleanup,
        (process.env.AGENT_BROWSER_STAGE_FILE &&
        fs.existsSync(
          process.env.AGENT_BROWSER_STAGE_FILE.replace(
            /\.json$/,
            ".cleanup.json"
          )
        )
          ? JSON.parse(
              fs.readFileSync(
                process.env.AGENT_BROWSER_STAGE_FILE.replace(
                  /\.json$/,
                  ".cleanup.json"
                )
              )
            ).deadline
          : Infinity) - Date.now()
      )
    );
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Browser close exceeded cleanup deadline.")),
          limit
        );
      }),
    ]);
    browserStage("complete");
  } catch (error) {
    browserStage("cleanup", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [action, value, role] = process.argv.slice(2);
  if (action === "resource") registerResource(Number(value), role);
  else if (action === "stage")
    browserStage(value, role ? new Error(role) : undefined);
  else throw new Error("Use resource PID ROLE or stage PHASE [ERROR].");
}
