/**
 * Capture a 2x WebP of a page on the agent verification server.
 *
 *   pnpm screenshot
 *   pnpm screenshot /demos/001-login-standard
 *   pnpm screenshot /foo --out zlocal/artifacts/screenshots/foo.webp
 *   pnpm screenshot /foo --theme dark --out public/foo-dark.webp
 *   pnpm screenshot --url http://127.0.0.1:3100/bar --no-full-page
 *
 * Defaults to the running `pnpm dev:agent` URL. Does not fall back to the
 * user's `pnpm dev` port. Pass `--url` to aim at a specific origin.
 *
 * Uses Playwright's bundled headless shell (`PLAYWRIGHT_BROWSERS_PATH=0`).
 * If the agent sandbox blocks localhost or browser launch, request host review
 * of this command against the owner-validated agent origin. Do not switch binaries.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { readAgentBaseURL, runBrowserPreflight } from "./browser-preflight.mjs";
import { closeBrowser, launchBrowser } from "./browser-session.mjs";
import {
  captureWebp,
  newCaptureContext,
  type ThemeName,
} from "./screenshot-capture.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "../..");
const SCREENSHOT_DIR = path.join(
  ROOT_DIR,
  "zlocal",
  "artifacts",
  "screenshots"
);

type ScreenshotArgs = {
  pagePath: string;
  url: string | undefined;
  out: string | undefined;
  fullPage: boolean;
  width: number;
  height: number;
  theme: ThemeName | undefined;
};

function printUsage() {
  process.stdout.write(
    [
      "Usage: pnpm screenshot [path] [--url <url>] [--out <file>] [--theme light|dark] [--viewport WxH] [--no-full-page]",
      "",
      "Captures a 2x lossless WebP. Uses the running agent server from its ownership record unless --url is set.",
      "Does not use the user's pnpm dev server.",
      "",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): ScreenshotArgs {
  let pagePath = "/";
  let url: string | undefined;
  let out: string | undefined;
  let fullPage = true;
  let width = 1440;
  let height = 900;
  let theme: ThemeName | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--url") {
      url = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--out") {
      out = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--theme") {
      const raw = argv[i + 1];
      if (raw !== "light" && raw !== "dark") {
        throw new Error(
          `--theme needs light or dark (got ${raw || "(missing)"})`
        );
      }
      theme = raw;
      i += 1;
      continue;
    }

    if (arg === "--no-full-page") {
      fullPage = false;
      continue;
    }

    if (arg === "--viewport") {
      const raw = argv[i + 1] ?? "";
      const match = /^(\d+)x(\d+)$/.exec(raw);
      if (!match) {
        throw new Error(`--viewport needs WxH (got ${raw || "(missing)"})`);
      }
      width = Number(match[1]);
      height = Number(match[2]);
      i += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    pagePath = arg.startsWith("/") ? arg : `/${arg}`;
  }

  return { pagePath, url, out, fullPage, width, height, theme };
}

function resolveTargetUrl(args: ScreenshotArgs): string {
  if (args.url) {
    const parsed = new URL(args.url);
    if (!args.url.endsWith(args.pagePath) && args.pagePath !== "/") {
      parsed.pathname = args.pagePath;
    }
    return parsed.toString();
  }

  const base = readAgentBaseURL(ROOT_DIR);

  return new URL(args.pagePath, `${base}/`).toString();
}

function defaultOutPath(targetUrl: string): string {
  const parsed = new URL(targetUrl);
  const slug =
    parsed.pathname
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "")
      .replaceAll("/", "-") || "root";
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "")
    .replaceAll(".", "-");
  return path.join(SCREENSHOT_DIR, `${slug}-${stamp}.webp`);
}

function ensureWebpOutPath(filePath: string): string {
  const ext = path.extname(filePath);
  if (ext.toLowerCase() === ".webp") {
    return filePath;
  }
  if (ext === "") {
    return `${filePath}.webp`;
  }
  return filePath.slice(0, -ext.length) + ".webp";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetUrl = resolveTargetUrl(args);
  const outPath = ensureWebpOutPath(
    path.resolve(ROOT_DIR, args.out ?? defaultOutPath(targetUrl))
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  if (
    !args.url ||
    (fs.existsSync(path.join(ROOT_DIR, "zlocal", ".agent-owner.json")) &&
      new URL(targetUrl).origin === readAgentBaseURL(ROOT_DIR))
  ) {
    await runBrowserPreflight({
      baseURL: new URL(targetUrl).origin,
      rootDir: ROOT_DIR,
    });
  }

  const browser = await launchBrowser(chromium);
  try {
    const context = await newCaptureContext(browser, {
      width: args.width,
      height: args.height,
      theme: args.theme,
    });
    const page = await context.newPage();
    const image = await captureWebp(page, targetUrl, {
      theme: args.theme,
      fullPage: args.fullPage,
    });
    fs.writeFileSync(outPath, image);
  } finally {
    await closeBrowser(browser);
  }

  process.stdout.write(`${outPath}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
