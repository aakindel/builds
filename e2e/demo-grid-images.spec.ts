import { expect, test } from "@playwright/test";

const MINI = 'img[src$="-mini.webp"]';
const ORIGINAL = 'img[aria-hidden="true"][src$=".webp"]';
const SCROLLER = "[data-page-scroll-container]";

test.use({ viewport: { width: 1680, height: 960 }, deviceScaleFactor: 2 });

test("initial HTML displays both thumbnail themes without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    expect(await page.locator(MINI).count()).toBeGreaterThan(0);
    await expect(page.locator(ORIGINAL)).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(MINI)
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth === 1200
            )
          )
      )
      .toBe(true);
  } finally {
    await context.close();
  }
});

test("zoom sharpens nearby cards, keeps both themes ready, and releases distant originals", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const thumbnails = page.locator(MINI);
  const originals = page.locator(ORIGINAL);
  const thumbnailCount = await thumbnails.count();
  expect(thumbnailCount).toBeGreaterThan(0);
  await expect(originals).toHaveCount(0);

  // Model 200% desktop zoom: half the CSS viewport, twice the pixel density.
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 840,
    height: 480,
    deviceScaleFactor: 4,
    mobile: false,
  });
  await expect.poll(() => originals.count()).toBeGreaterThan(0);
  expect(await originals.count()).toBeLessThan(thumbnailCount);
  await expect
    .poll(() =>
      originals.evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth === 2880 &&
            getComputedStyle(image).opacity === "1"
        )
      )
    )
    .toBe(true);
  await expect(thumbnails).toHaveCount(thumbnailCount);

  const firstOriginal = originals.first();
  const firstSource = await firstOriginal.getAttribute("src");
  await page.locator(SCROLLER).evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator(`img[src="${firstSource}"]`)).toHaveCount(0);
  await expect.poll(() => originals.count()).toBeGreaterThan(0);
  expect(await originals.count()).toBeLessThan(thumbnailCount);
  await expect
    .poll(() =>
      originals.evaluateAll((images) =>
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            getComputedStyle(image).opacity === "1"
        )
      )
    )
    .toBe(true);

  await page.getByRole("button", { name: "Theme Toggle", exact: true }).click();
  await expect
    .poll(() =>
      originals.evaluateAll((images) => {
        const dark = document.documentElement.classList.contains("dark");
        return images
          .filter((image) => getComputedStyle(image).display !== "none")
          .every(
            (image) =>
              image
                .getAttribute("src")
                ?.endsWith(dark ? "-dark.webp" : "-light.webp") &&
              getComputedStyle(image).opacity === "1"
          );
      })
    )
    .toBe(true);

  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1680,
    height: 960,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await expect(originals).toHaveCount(0);
  await expect(thumbnails).toHaveCount(thumbnailCount);
  await session.detach();
});

test("an unavailable original leaves both working thumbnails visible", async ({
  page,
  context,
}) => {
  await page.route("**/*-dark.webp", (route) => route.abort());
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 840,
    height: 480,
    deviceScaleFactor: 4,
    mobile: false,
  });
  await page.goto("/");
  await expect.poll(() => page.locator(ORIGINAL).count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page
        .locator(MINI)
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth === 1200
          )
        )
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(ORIGINAL)
        .evaluateAll((images) =>
          images.every((image) => getComputedStyle(image).opacity === "0")
        )
    )
    .toBe(true);
  await page.getByRole("button", { name: "Theme Toggle", exact: true }).click();
  expect(
    await page
      .locator(MINI)
      .evaluateAll((images) =>
        images
          .filter((image) => getComputedStyle(image).display !== "none")
          .every((image) => getComputedStyle(image).opacity === "1")
      )
  ).toBe(true);
  await session.detach();
});

test("split demos load their shared public image", async ({ page }) => {
  for (const slug of [
    "009-login-split-card",
    "012-login-split",
    "021-signup-split-card",
    "024-signup-split",
  ]) {
    await page.goto(`/demos/${slug}`);
    const placeholder = page.locator('img[src="/image-placeholder.svg"]');
    await expect(placeholder).toHaveCount(1);
    await expect
      .poll(() =>
        placeholder.evaluate(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0
        )
      )
      .toBe(true);
  }
});
