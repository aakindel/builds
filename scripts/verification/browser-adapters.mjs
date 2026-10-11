import fs from "node:fs";
import path from "node:path";
import { verificationCommand } from "./agent-verify.mjs";

export function operationCommand(root, operation, args = []) {
  if (operation === "claudex" && args.length === 0) {
    const file =
      "scripts/editors/vscursor-claudex/vscursor-claudex-browser-check.mjs";
    if (!fs.existsSync(path.join(root, file)))
      throw new Error("This project has no Claudex browser adapter.");
    return [process.execPath, file];
  }
  if (operation === "e2e") {
    verificationCommand(root, "agent", args);
    return ["/bin/bash", "scripts/verification/e2e-run.sh", ...args];
  }
  verificationCommand(root, operation, args);
  return [
    process.execPath,
    "scripts/verification/agent-verify.mjs",
    operation,
    ...args,
  ];
}

export function assertOperationPrerequisites(root, operation, args = []) {
  const required = ["scripts/verification/browser-spawn-tracker.mjs"];
  if (operation !== "claudex")
    required.push(
      "scripts/dev/agent-dev.sh",
      "app/api/verification-health/route.ts",
      "scripts/verification/agent-verify.mjs",
      "scripts/verification/browser-preflight.mjs"
    );
  if (["agent", "alignment"].includes(operation)) {
    if (!args.length)
      throw new Error(
        `${operation} requires explicit checked-in e2e/*.spec.ts selections.`
      );
    required.push(`playwright.${operation}.config.ts`);
  }
  if (operation === "screenshot")
    required.push("scripts/verification/screenshot.ts");
  if (operation === "e2e")
    required.push("scripts/verification/e2e-run.sh", "playwright.config.ts");
  if (
    operation !== "claudex" &&
    requiredComponents(root, operation).includes("convex")
  )
    required.push("scripts/verification/e2e-convex-backend.sh");
  const missing = required.filter(
    (file) => !fs.existsSync(path.join(root, file))
  );
  if (missing.length)
    throw new Error(
      `Missing ${operation} adapter prerequisites: ${missing.join(", ")}. Install or author that adapter before running it. No owned server was started.`
    );
}

export function requiredComponents(root, operation) {
  return operation === "claudex"
    ? ["chromium"]
    : fs.existsSync(path.join(root, "convex"))
      ? ["next", "convex", "chromium"]
      : ["next", "chromium"];
}
