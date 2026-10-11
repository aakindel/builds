/**
 * Shared Playwright capture steps for `pnpm screenshot` and
 * `pnpm screenshots:update`.
 */

import { type Browser, type BrowserContext, type Page } from "@playwright/test";
import { assertHealthyPage } from "./browser-preflight.mjs";

export type ThemeName = "light" | "dark";

type PageGlobal = {
  localStorage: { setItem: (key: string, value: string) => void };
  document: {
    images: Iterable<{
      complete: boolean;
      naturalWidth: number;
      currentSrc: string;
    }>;
    documentElement: { classList: { contains: (token: string) => boolean } };
    fonts: { ready: Promise<unknown> };
  };
};

export async function newCaptureContext(
  browser: Browser,
  options: { width: number; height: number; theme: ThemeName | undefined }
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 2,
    colorScheme: options.theme,
    reducedMotion: "reduce",
  });

  if (options.theme) {
    await context.addInitScript((theme) => {
      (globalThis as unknown as PageGlobal).localStorage.setItem(
        "theme",
        theme
      );
    }, options.theme);
  }

  return context;
}

/** Load `url`, wait for theme and fonts, and return a lossless WebP. */
export async function captureWebp(
  page: Page,
  url: string,
  options: { theme: ThemeName | undefined; fullPage: boolean }
): Promise<Buffer> {
  await assertHealthyPage(page, url);
  if (options.theme) {
    await page.waitForFunction((theme) => {
      const isDark = (
        globalThis as unknown as PageGlobal
      ).document.documentElement.classList.contains("dark");
      return theme === "dark" ? isDark : !isDark;
    }, options.theme);
  }
  await page.evaluate(async () => {
    await (globalThis as unknown as PageGlobal).document.fonts.ready;
  });
  const failedImages = await page.evaluate(() =>
    Array.from((globalThis as unknown as PageGlobal).document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc)
  );
  if (failedImages.length) {
    throw new Error(
      `Refusing to screenshot failed images at ${url}: ${failedImages.join(", ")}`
    );
  }
  const pageTitle = await page.title();
  if (pageTitle.startsWith("404:")) {
    throw new Error(`Refusing to screenshot 404 at ${url}`);
  }
  // Next.js Dev Tools badge lives in a nextjs-portal shadow root.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  return page.screenshot({
    type: "webp",
    quality: 100,
    scale: "device",
    fullPage: options.fullPage,
  });
}
