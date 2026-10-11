// Maintained preload: observe actual launches without changing their options.

import childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import {
  browserStage,
  browserTimeouts,
  launchBlocked,
  recordBrowserProcess,
  registerResource,
} from "./browser-session.mjs";
import {
  createProcessAnchor,
  processIdentity,
} from "./verification-process.mjs";

const root = process.env.AGENT_BROWSER_ROOT;
if (
  root &&
  process.env.AGENT_BROWSER_TOKEN &&
  process.env.AGENT_BROWSER_STAGE_FILE
) {
  const anchorFile = process.env.AGENT_BROWSER_STAGE_FILE.replace(
    /\.json$/,
    ".anchor-" + process.pid + "-" + randomUUID()
  );
  // Opening an anchor is guarded by the same private diagnostic path validation.
  browserStage("runtime", undefined, "observer");
  const anchor = createProcessAnchor(anchorFile);
  const self = processIdentity(
    process.pid,
    process.env.AGENT_BROWSER_TOKEN,
    "node"
  );
  if (!self) throw new Error("Cannot retain observer identity.");
  recordBrowserProcess({ type: "resource", identity: { ...self, anchor } });
  const original = childProcess.spawn;
  childProcess.spawn = function (...parameters) {
    const [executable, args] = parameters;
    const intent = randomUUID();
    const browser =
      /^(?:Chromium|Google Chrome for Testing|chrome|chrome-headless-shell|headless_shell)(?:\.exe)?$/.test(
        path.basename(String(executable))
      );
    if (browser && launchBlocked())
      throw new Error(
        "Unresolved native launch failure blocks another browser."
      );
    recordBrowserProcess({
      type: "intent",
      intent,
      parent: process.pid,
      executable: String(executable),
      role: browser ? "chromium" : "child",
      at: Date.now(),
    });
    let child,
      receiptComplete = false;
    try {
      child = original.apply(this, parameters);
    } catch (error) {
      recordBrowserProcess({ type: "spawn-error", intent, code: error.code });
      throw error;
    }
    recordBrowserProcess({
      type: "spawned",
      intent,
      pid: child.pid,
      parent: process.pid,
      boot: self.boot,
      token: self.token,
      nodeExecutable: process.execPath,
      at: Date.now(),
    });
    child.once("error", (error) => {
      recordBrowserProcess({ type: "spawn-error", intent, code: error.code });
      receiptComplete = true;
    });
    child.once("exit", () => {
      if (!receiptComplete) {
        // ChildProcess close identifies this exact reaped child, without
        // inventing start/executable data for a command too fast to inspect.
        recordBrowserProcess({
          type: "reaped",
          intent,
          pid: child.pid,
          parent: process.pid,
        });
        receiptComplete = true;
      }
    });
    child.once("spawn", () => {
      let identity;
      try {
        identity = registerResource(child.pid, browser ? "chromium" : "child");
      } catch {
        try {
          process.kill(child.pid, 0);
        } catch (error) {
          if (error.code === "ESRCH") {
            recordBrowserProcess({
              type: "spawn-error",
              intent,
              code: "ESRCH",
            });
            receiptComplete = true;
          }
        }
        return;
      }
      if (!identity) {
        recordBrowserProcess({ type: "spawn-error", intent, code: "ESRCH" });
        receiptComplete = true;
        return;
      }
      const profile = Array.isArray(args)
        ? args
            .find(
              (arg) =>
                typeof arg === "string" && arg.startsWith("--user-data-dir=")
            )
            ?.slice(16)
        : undefined;
      recordBrowserProcess({
        type: "resource",
        intent,
        identity: { ...identity, profile },
        profile: Array.isArray(args)
          ? args
              .find(
                (arg) =>
                  typeof arg === "string" && arg.startsWith("--user-data-dir=")
              )
              ?.slice(16)
          : undefined,
      });
      receiptComplete = true;
    });
    return child;
  };
  syncBuiltinESMExports();
  const require = createRequire(path.join(root, "package.json"));
  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch {
    /* Frozen dependency preparation may precede this package. */
  }
  if (typeof chromium?.launch === "function") {
    const launch = chromium.launch;
    chromium.launch = async function (options = {}) {
      if (
        options.executablePath ||
        options.channel ||
        options.headless === false ||
        options.devtools === true
      )
        throw new Error(
          "Registered verification uses bundled headless Chromium."
        );
      if (launchBlocked())
        throw new Error(
          "Unresolved native launch failure blocks another browser."
        );
      browserStage("chromium-launch");
      try {
        const limit =
          process.env.AGENT_BROWSER_ROUTE === "reviewed"
            ? browserTimeouts.reviewed
            : browserTimeouts.sandbox;
        const browser = await launch.call(this, {
          ...options,
          headless: true,
          timeout: Math.min(options.timeout || limit, limit),
        });
        browserStage("fixtures");
        return browser;
      } catch (error) {
        browserStage("chromium-launch", error);
        throw error;
      }
    };
  }
}
