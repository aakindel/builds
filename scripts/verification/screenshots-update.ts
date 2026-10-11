/**
 * Recapture demo preview screenshots in public/demos.
 *
 *   pnpm screenshots:update                    stale, missing and new demos
 *   pnpm screenshots:update demos/001-login-standard   one demo
 *   pnpm screenshots:update --all              every demo (after shared changes)
 *   pnpm screenshots:update --dry-run          print the plan only
 *
 * Writes a WebP only when its decoded pixels change, records each captured
 * demo's source hash in screenshots.manifest.json, and deletes shots and
 * manifest entries whose demo folder no longer exists. The pre-commit guard
 * (scripts/checks/screenshot-guard.mjs) checks the same manifest.
 *
 * Uses the running `pnpm dev:agent` server, or starts one and stops it when
 * done. Never uses the user's `pnpm dev` server.
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  collectState,
  demoDir,
  demoKeyOf,
  demoRoute,
  findProblems,
  formatManifest,
  MANIFEST_PATH,
  readWorktreeListing,
  readWorktreeManifest,
  shotPath,
  THEMES,
  type Problem,
  type Theme,
} from "../checks/demo-screenshots-lib.mjs";
import { readAgentBaseURL, runBrowserPreflight } from "./browser-preflight.mjs";
import { closeBrowser, launchBrowser } from "./browser-session.mjs";
import { updateDemoThumbnail } from "./demo-thumbnails.mjs";
import { captureWebp, newCaptureContext } from "./screenshot-capture.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const OWNER_FILE = path.join(ROOT_DIR, "zlocal", ".agent-owner.json");
const LOG_DIR = path.join(
  ROOT_DIR,
  "zlocal",
  "artifacts",
  "screenshots-update"
);
const SERVER_READY_MS = 180_000;
const SERVER_EXIT_MS = 20_000;

// Every demo preview uses these settings. Changing them changes every shot.
const CAPTURE = { width: 1440, height: 900, fullPage: false } as const;

type Args = {
  targets: string[];
  all: boolean;
  dryRun: boolean;
  miniOnly: boolean;
};

type Plan = {
  capture: Map<string, string>;
  pruneShots: string[];
  pruneEntries: string[];
  thumbnails: string[];
};

type ShotResult =
  | { file: string; status: "added" | "unchanged" }
  | { file: string; status: "changed"; percent: number };

function printUsage() {
  process.stdout.write(
    [
      "Usage: pnpm screenshots:update [target...] [--all] [--dry-run] [--mini-only]",
      "",
      "Without targets, recaptures demos whose source changed since the manifest,",
      "demos missing a shot, and new demos. A target (demos,",
      "demos/001-login-standard, or a demo folder path)",
      "recaptures every demo under it. --all recaptures every demo.",
      "--mini-only refreshes thumbnails from existing originals without a browser.",
      "",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    targets: [],
    all: false,
    dryRun: false,
    miniOnly: false,
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--mini-only") {
      args.miniOnly = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      args.targets.push(normalizeTarget(arg));
    }
  }
  if (args.all && args.targets.length > 0) {
    throw new Error("--all recaptures every demo; drop the targets or --all.");
  }
  return args;
}

function normalizeTarget(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  return (
    demoKeyOf(`${trimmed}/page.tsx`) ??
    trimmed.replace(/^\/+/, "").replace(/^public\//, "")
  );
}

function inScope(key: string, targets: string[]): boolean {
  return (
    targets.length === 0 ||
    targets.some((target) => key === target || key.startsWith(`${target}/`))
  );
}

function reasonOf(problems: Problem[]): string {
  const kinds = new Set(problems.map((problem) => problem.kind));
  if (kinds.has("uncaptured")) return "new";
  if (kinds.has("stale")) return "source changed";
  return "shot missing";
}

function buildPlan(args: Args): Plan & { hashes: Map<string, string> } {
  const state = collectState(readWorktreeListing(ROOT_DIR));
  const manifest = readWorktreeManifest(ROOT_DIR);
  const problems = findProblems(state, manifest);
  const capture = new Map<string, string>();

  if (args.all || args.targets.length > 0) {
    for (const key of state.demos.keys()) {
      if (inScope(key, args.targets)) capture.set(key, "requested");
    }
    const unmatched = args.targets.filter(
      (target) => ![...state.demos.keys()].some((key) => inScope(key, [target]))
    );
    if (unmatched.length > 0) {
      throw new Error(`No demos match: ${unmatched.join(", ")}`);
    }
  } else {
    const byKey = new Map<string, Problem[]>();
    for (const problem of problems) {
      if (!state.demos.has(problem.key)) continue;
      // Missing derivatives can be rebuilt from originals without recapture.
      if (problem.kind === "missing-shot" && problem.theme?.endsWith("-mini"))
        continue;
      byKey.set(problem.key, [...(byKey.get(problem.key) ?? []), problem]);
    }
    for (const [key, keyProblems] of byKey) {
      capture.set(key, reasonOf(keyProblems));
    }
  }

  const pruneShots = problems
    .filter(
      (problem) =>
        problem.kind === "orphan-shot" && inScope(problem.key, args.targets)
    )
    .map((problem) => shotPath(problem.key, problem.theme ?? ""));
  const pruneEntries = problems
    .filter(
      (problem) =>
        problem.kind === "orphan-entry" && inScope(problem.key, args.targets)
    )
    .map((problem) => problem.key);

  return {
    capture: new Map(
      [...capture]
        .filter(() => !args.miniOnly)
        .sort(([a], [b]) => (a < b ? -1 : 1))
    ),
    pruneShots,
    pruneEntries,
    hashes: state.demos,
    thumbnails: [...state.demos.keys()]
      .filter((key) => inScope(key, args.targets))
      .sort(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serverReady(): Promise<string | null> {
  try {
    const baseURL = readAgentBaseURL(ROOT_DIR);
    const response = await fetch(`${baseURL}/api/verification-health`, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok ? baseURL : null;
  } catch {
    return null;
  }
}

/** Reuse the running agent server, or start one this run owns. */
async function ensureServer(): Promise<{
  baseURL: string;
  child: ChildProcess | null;
}> {
  if (fs.existsSync(OWNER_FILE)) {
    return { baseURL: readAgentBaseURL(ROOT_DIR), child: null };
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(
    LOG_DIR,
    `server-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
  );
  const log = fs.openSync(logPath, "a");
  process.stdout.write(`Starting pnpm dev:agent (log: ${logPath})\n`);
  const child = spawn("bash", ["scripts/dev/agent-dev.sh"], {
    cwd: ROOT_DIR,
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);

  const deadline = Date.now() + SERVER_READY_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `pnpm dev:agent exited during startup. See ${path.relative(ROOT_DIR, logPath)}.`
      );
    }
    const baseURL = await serverReady();
    if (baseURL) return { baseURL, child };
    await sleep(1_000);
  }
  await stopServer(child);
  throw new Error(
    `pnpm dev:agent was not ready within ${SERVER_READY_MS / 1000}s.`
  );
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    execFileSync("bash", ["scripts/dev/agent-dev-stop.sh"], {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
  } catch {
    process.stderr.write(
      "pnpm dev:agent:stop failed; inspect the agent server records.\n"
    );
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", resolve));
  await Promise.race([exited, sleep(SERVER_EXIT_MS)]);
}

type DecodeGlobal = {
  atob: (data: string) => string;
  Blob: new (parts: Uint8Array[], options: { type: string }) => unknown;
  createImageBitmap: (
    blob: unknown
  ) => Promise<{ width: number; height: number }>;
  OffscreenCanvas: new (
    width: number,
    height: number
  ) => {
    getContext: (kind: "2d") => {
      drawImage: (image: unknown, x: number, y: number) => void;
      getImageData: (
        x: number,
        y: number,
        width: number,
        height: number
      ) => { data: Uint8ClampedArray };
    };
  };
};

/** Share of pixels that differ between two WebPs, decoded by Chromium. */
async function pixelDifference(
  page: Page,
  before: Buffer,
  after: Buffer
): Promise<number> {
  return page.evaluate(
    async ([a, b]) => {
      const g = globalThis as unknown as DecodeGlobal;
      const decode = async (base64: string) => {
        const binary = g.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const bitmap = await g.createImageBitmap(
          new g.Blob([bytes], { type: "image/webp" })
        );
        const context = new g.OffscreenCanvas(
          bitmap.width,
          bitmap.height
        ).getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return {
          width: bitmap.width,
          height: bitmap.height,
          data: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        };
      };
      const [first, second] = await Promise.all([decode(a), decode(b)]);
      if (first.width !== second.width || first.height !== second.height) {
        return 1;
      }
      let different = 0;
      for (let i = 0; i < first.data.length; i += 4) {
        if (
          first.data[i] !== second.data[i] ||
          first.data[i + 1] !== second.data[i + 1] ||
          first.data[i + 2] !== second.data[i + 2] ||
          first.data[i + 3] !== second.data[i + 3]
        ) {
          different += 1;
        }
      }
      return different / (first.width * first.height);
    },
    [before.toString("base64"), after.toString("base64")] as const
  );
}

function indexFlagMissing(key: string): boolean {
  const indexFile = path.join(ROOT_DIR, path.dirname(demoDir(key)), "index.ts");
  if (!fs.existsSync(indexFile)) return true;
  const slug = path.basename(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`slug:\\s*"${slug}",\\s*hasScreenshot:\\s*true`).test(
    fs.readFileSync(indexFile, "utf8")
  );
}

async function captureAll(
  browser: Browser,
  baseURL: string,
  keys: string[]
): Promise<{
  results: ShotResult[];
  captured: string[];
  failed: { key: string; message: string }[];
}> {
  const pages = new Map<Theme, Page>();
  for (const theme of THEMES) {
    const context = await newCaptureContext(browser, {
      width: CAPTURE.width,
      height: CAPTURE.height,
      theme,
    });
    pages.set(theme, await context.newPage());
  }
  const compare = await (await browser.newContext()).newPage();

  const results: ShotResult[] = [];
  const captured: string[] = [];
  const failed: { key: string; message: string }[] = [];

  for (const [index, key] of keys.entries()) {
    process.stdout.write(`[${index + 1}/${keys.length}] ${key}\n`);
    try {
      const images = new Map<Theme, Buffer>();
      for (const theme of THEMES) {
        const page = pages.get(theme);
        if (!page) throw new Error(`No ${theme} page`);
        images.set(
          theme,
          await captureWebp(page, new URL(demoRoute(key), baseURL).toString(), {
            theme,
            fullPage: CAPTURE.fullPage,
          })
        );
      }
      for (const [theme, image] of images) {
        const file = shotPath(key, theme);
        const absolute = path.join(ROOT_DIR, file);
        if (!fs.existsSync(absolute)) {
          fs.mkdirSync(path.dirname(absolute), { recursive: true });
          fs.writeFileSync(absolute, image);
          results.push({ file, status: "added" });
          continue;
        }
        const share = await pixelDifference(
          compare,
          fs.readFileSync(absolute),
          image
        );
        if (share === 0) {
          results.push({ file, status: "unchanged" });
        } else {
          fs.writeFileSync(absolute, image);
          results.push({ file, status: "changed", percent: share * 100 });
        }
      }
      captured.push(key);
    } catch (error) {
      failed.push({
        key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { results, captured, failed };
}

function printPlan(plan: Plan) {
  if (plan.capture.size > 0) {
    process.stdout.write(`Capture ${plan.capture.size} demos:\n`);
    for (const [key, reason] of plan.capture) {
      process.stdout.write(`  ${key} (${reason})\n`);
    }
  }
  for (const file of plan.pruneShots) {
    process.stdout.write(`Delete ${file} (no demo)\n`);
  }
  for (const key of plan.pruneEntries) {
    process.stdout.write(`Remove manifest entry ${key} (no demo)\n`);
  }
  if (plan.thumbnails.length > 0) {
    process.stdout.write(
      `Refresh thumbnails for ${plan.thumbnails.length} demos from stored screenshots.\n`
    );
  }
}

async function refreshThumbnails(keys: string[]): Promise<number> {
  const counts = { added: 0, changed: 0, unchanged: 0, failed: 0 };
  for (const key of keys) {
    for (const theme of THEMES) {
      try {
        const result = await updateDemoThumbnail(ROOT_DIR, key, theme);
        counts[result.status] += 1;
        if (result.status !== "unchanged")
          process.stdout.write(`  ${result.status} ${result.file}\n`);
      } catch (error) {
        counts.failed += 1;
        process.stderr.write(
          `  failed ${key}-${theme}-mini.webp: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }
  }
  process.stdout.write(
    `Thumbnails: ${counts.added} added, ${counts.changed} changed, ${counts.unchanged} unchanged, ${counts.failed} failed.\n`
  );
  return counts.failed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = buildPlan(args);

  if (
    plan.capture.size === 0 &&
    plan.pruneShots.length === 0 &&
    plan.pruneEntries.length === 0 &&
    plan.thumbnails.length === 0
  ) {
    process.stdout.write("Screenshots are up to date.\n");
    return;
  }

  printPlan(plan);
  if (args.dryRun) return;

  for (const file of plan.pruneShots) {
    fs.rmSync(path.join(ROOT_DIR, file), { force: true });
  }
  const manifest = readWorktreeManifest(ROOT_DIR);
  for (const key of plan.pruneEntries) delete manifest[key];

  let failedCount = 0;
  try {
    if (plan.capture.size > 0) {
      failedCount = await captureAndRecord(plan, manifest);
    }
    failedCount += await refreshThumbnails(plan.thumbnails);
  } finally {
    const manifestPath = path.join(ROOT_DIR, MANIFEST_PATH);
    const formatted = formatManifest(manifest);
    if (
      !fs.existsSync(manifestPath) ||
      fs.readFileSync(manifestPath, "utf8") !== formatted
    )
      fs.writeFileSync(manifestPath, formatted);
  }
  process.stdout.write(
    `\nStage public/demos and ${MANIFEST_PATH} with the demo change.\n`
  );
  if (failedCount > 0) process.exitCode = 1;
}

async function captureAndRecord(
  plan: Plan & { hashes: Map<string, string> },
  manifest: Record<string, string>
): Promise<number> {
  const { baseURL, child } = await ensureServer();
  const stop = () => {
    if (child) void stopServer(child).finally(() => process.exit(130));
    else process.exit(130);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await runBrowserPreflight({ baseURL, rootDir: ROOT_DIR });
    const browser = await launchBrowser(chromium);
    let outcome;
    try {
      outcome = await captureAll(browser, baseURL, [...plan.capture.keys()]);
    } finally {
      await closeBrowser(browser);
    }

    for (const key of outcome.captured) {
      const hash = plan.hashes.get(key);
      if (hash) manifest[key] = hash;
    }
    printSummary(baseURL, outcome);
    return outcome.failed.length;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (child) await stopServer(child);
  }
}

function printSummary(
  baseURL: string,
  outcome: Awaited<ReturnType<typeof captureAll>>
) {
  const { results, captured, failed } = outcome;
  const lines = [
    "",
    `Captured ${captured.length} demos from ${baseURL}`,
    ...results.flatMap((result) =>
      result.status === "changed"
        ? [
            `  changed   ${result.file} (${result.percent.toFixed(2)}% of pixels)`,
          ]
        : []
    ),
    ...results
      .filter((result) => result.status === "added")
      .map((result) => `  added     ${result.file}`),
    `  unchanged ${results.filter((result) => result.status === "unchanged").length} shots`,
  ];
  const unflagged = captured.filter(indexFlagMissing);
  if (unflagged.length > 0) {
    lines.push(
      "",
      "Set hasScreenshot: true in demos/index.ts for:",
      ...unflagged.map((key) => `  ${key}`)
    );
  }
  if (failed.length > 0) {
    lines.push(
      "",
      `Failed ${failed.length} demos (manifest left unchanged):`,
      ...failed.map(({ key, message }) => `  ${key}: ${message}`)
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
