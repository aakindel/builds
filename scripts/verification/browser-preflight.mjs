import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ranges,
  readAgentBaseURL,
  readAgentOwner,
  readE2eEnvironment,
  validateOrigin,
} from "../dev/runtime-servers.mjs";
import {
  browserStage,
  closeBrowser,
  launchBrowser,
} from "./browser-session.mjs";

const require = createRequire(import.meta.url);

export { readAgentBaseURL } from "../dev/runtime-servers.mjs";

export function validateVerificationURL(
  baseURL,
  role,
  rootDir = process.cwd()
) {
  const origin = validateOrigin(baseURL, role);
  if (role === "agent" && origin !== readAgentBaseURL(rootDir)) {
    throw new Error(
      "Verification URL does not match this checkout's ownership record."
    );
  }
  if (role === "e2e" && origin !== readE2eEnvironment(rootDir).baseURL) {
    throw new Error(
      "Verification URL does not match this E2E launcher's endpoint."
    );
  }
  return origin;
}

function describeError(error) {
  const messages = [];
  for (let current = error; current; current = current.cause) {
    messages.push(current.stack ?? String(current));
  }
  return messages.join("\nCaused by: ");
}

export async function assertHealthyPage(page, url, requireStyles = false) {
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    if (!response?.ok() || new URL(page.url()).origin !== new URL(url).origin) {
      throw new Error(
        `Fixture did not load at ${url}: HTTP ${response?.status() ?? "no response"}.`
      );
    }
    const overlay = page.locator(
      "nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-error-overlay]"
    );
    if (errors.length || (await overlay.count())) {
      throw new Error(
        `Runtime error at ${url}: ${errors.join("; ") || (await overlay.first().innerText())}`
      );
    }
    if (requireStyles) {
      const styled = await page.evaluate(() =>
        Boolean(
          globalThis
            .getComputedStyle(globalThis.document.documentElement)
            .getPropertyValue("--background")
            .trim()
        )
      );
      if (!styled)
        throw new Error(
          `Global styles are missing at ${url}; check the fixture root layout.`
        );
    }
  } finally {
    page.off("pageerror", onError);
  }
}

// No permission changes or retries here. The agent submits a host-reviewed retry
// after a sandbox block; application and test failures remain test failures.
export async function runBrowserPreflight(
  {
    baseURL,
    role = "agent",
    rootDir = process.cwd(),
    paths = [],
    requireStyles = false,
  },
  dependencies = {}
) {
  let stage = "target";
  let browser;
  let failure;
  const report = {
    ok: false,
    role,
    baseURL,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
  };
  try {
    const origin = validateVerificationURL(baseURL, role, rootDir);
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    const chromium =
      dependencies.chromium ?? (await import("@playwright/test")).chromium;
    report.playwright = require("@playwright/test/package.json").version;
    // executablePath() names full Chromium even when launch() selects its
    // companion headless shell. Preserve that distinction in diagnostics.
    report.chromiumExecutable = chromium.executablePath();
    report.launchMode = "bundled-headless-shell";
    stage = "localhost";
    browserStage(stage);
    const response = await (dependencies.fetch ?? globalThis.fetch)(
      `${origin}/api/verification-health`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(90_000),
      }
    );
    if (!response.ok)
      throw new Error(
        `Verification health endpoint returned HTTP ${response.status}.`
      );
    const identity = await response.json();
    const runId =
      role === "e2e"
        ? readE2eEnvironment(rootDir).runId
        : readAgentOwner(rootDir).runId;
    if (
      !runId ||
      identity.role !== role ||
      identity.root !== fs.realpathSync(rootDir) ||
      identity.runId !== runId
    ) {
      throw new Error(
        "Listener is not this project's isolated verification server. Restart pnpm dev:agent."
      );
    }
    // Ends the localhost deadline before the browser phases begin.
    browserStage("next-ready");
    stage = "chromium-launch";
    browser = await launchBrowser(chromium);
    report.browser = browser.version();
    stage = "browser-interaction";
    const page = await browser.newPage();
    await page.setContent(
      "<button onclick=\"this.textContent='Passed'\">Preflight</button>"
    );
    await page.getByRole("button", { name: "Preflight", exact: true }).click();
    if ((await page.getByRole("button").textContent()) !== "Passed") {
      throw new Error("Chromium DOM interaction failed.");
    }
    stage = "fixtures";
    for (const fixturePath of paths) {
      const target = new URL(fixturePath, origin);
      if (target.origin !== origin)
        throw new Error("Preflight fixtures must stay on the isolated server.");
      await assertHealthyPage(page, target.href, requireStyles);
    }
    stage = "cleanup";
  } catch (error) {
    failure = error;
  } finally {
    if (browser) {
      try {
        await closeBrowser(browser);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  report.stage = stage;
  report.ok = !failure;
  if (failure) report.error = describeError(failure);
  if (failure) browserStage(stage, failure);
  const reportDir = path.join(
    rootDir,
    "zlocal",
    "artifacts",
    "browser-preflight"
  );
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, `${ranges[role] ? role : "invalid"}.json`),
    `${JSON.stringify(report, null, 2)}\n`
  );
  if (failure) {
    const hint =
      stage === "localhost" || stage === "chromium-launch"
        ? "If the log shows sandbox EPERM, SIGTRAP, or SIGABRT, submit this same isolated verification command through host permission review. Do not change browser flags or disable isolation."
        : "Fix the reported target, runtime, or fixture error before running the suite.";
    throw new Error(
      `Browser preflight failed at ${stage}. ${hint}\nPlaywright ${report.playwright ?? "unknown"}; ${report.launchMode ?? "browser unresolved"}; bundled Chromium: ${report.chromiumExecutable ?? "unresolved"}\n${report.error}`,
      { cause: failure }
    );
  }
  process.stdout.write(
    `Browser preflight passed: ${baseURL}, Playwright ${report.playwright}, Chromium ${report.browser}\n`
  );
  return report;
}

export default async function globalSetup(config) {
  const options = config.metadata.browserVerification;
  if (!options)
    throw new Error(
      "Missing browserVerification metadata in Playwright config."
    );
  await runBrowserPreflight({
    ...options,
    baseURL: config.projects[0].use.baseURL,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await runBrowserPreflight({ baseURL: readAgentBaseURL() });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
