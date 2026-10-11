import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const sharp = createRequire(import.meta.url)(
  "sharp"
) as typeof import("sharp").default;

for (const width of [375, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`concentric padding matches the reference background at ${width}px in ${theme} mode`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (theme) => localStorage.setItem("theme", theme),
        theme
      );
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() =>
          page
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
        )
        .toBe(true);
      const cards = page.locator('[class~="group/basic-demo-page"]');
      await expect(cards.first()).toHaveCSS("border-top-left-radius", "22px");
      await expect(cards.first()).toHaveCSS("padding-top", "12px");
      await expect(cards.first().locator(":scope > div").first()).toHaveCSS(
        "border-top-left-radius",
        "10px"
      );
      const demo = page.getByRole("link", {
        name: "Login Standard",
        exact: true,
      });
      const content = cards.locator("img:visible, a");
      const bounds = await content.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        })
      );
      const screenshots = [];
      for (const state of ["rest", "hover"]) {
        await page.mouse.move(0, 0);
        if (state === "hover") await demo.hover();
        screenshots.push(
          await page.screenshot({
            animations: "disabled",
            mask: [
              page.getByRole("button", { name: "Theme Toggle", exact: true }),
            ],
            path: `zlocal/artifacts/screenshots/padding-${width}-${theme}-${state}.png`,
            style: "nextjs-portal { visibility: hidden !important; }",
          })
        );
      }

      // Keep the original layout reference, with the intended 22px outer radius.
      await cards.evaluateAll((elements) =>
        elements.forEach((element) => {
          const preview = element.firstElementChild;
          if (preview)
            (element as HTMLElement).style.setProperty(
              "--ui-demo-grid-preview-radius",
              getComputedStyle(preview).borderTopLeftRadius
            );
          element.setAttribute(
            "class",
            "group/basic-demo-page relative before:absolute before:-inset-3 before:z-0 before:rounded-6xl before:bg-neutral-100/70 before:opacity-0 hover:before:opacity-100 dark:before:bg-neutral-900/70"
          );
        })
      );
      expect(
        await content.evaluateAll((elements) =>
          elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          })
        )
      ).toEqual(bounds);
      await demo.evaluate((element) => element.blur());
      for (const [index, state] of ["rest", "hover"].entries()) {
        await page.mouse.move(0, 0);
        if (state === "hover") await demo.hover();
        const reference = await page.screenshot({
          animations: "disabled",
          mask: [
            page.getByRole("button", { name: "Theme Toggle", exact: true }),
          ],
          path: `zlocal/artifacts/screenshots/pseudo-${width}-${theme}-${state}.png`,
          style: "nextjs-portal { visibility: hidden !important; }",
        });
        const actualPixels = await sharp(screenshots[index]).raw().toBuffer();
        const referencePixels = await sharp(reference).raw().toBuffer();
        expect(
          actualPixels.equals(referencePixels),
          `${state} pixels differ from the original`
        ).toBe(true);
      }
    });
  }
}

for (const width of [375, 1280]) {
  test(`the full hover area opens the demo and preserves the source target at ${width}px without JavaScript`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      const card = page.locator('[class~="group/basic-demo-page"]').first();
      const demo = card.locator('[data-slot="demo-link"]');
      const source = card.getByRole("link", {
        name: "View Login Standard on GitHub",
        exact: true,
      });
      const bounds = await card.boundingBox();
      const title = await demo.locator("p").boundingBox();
      const preview = await card.locator(":scope > div").first().boundingBox();
      const sourceBounds = await source.boundingBox();
      if (!bounds || !title || !preview || !sourceBounds)
        throw new Error("Missing demo card bounds");
      const centerX = bounds.x + bounds.width / 2;
      const bottom = {
        x: centerX,
        y: (title.y + title.height + bounds.y + bounds.height) / 2,
      };
      const points = [
        bottom,
        { x: centerX, y: bounds.y + 1 },
        { x: centerX, y: bounds.y + bounds.height - 1 },
        { x: bounds.x + 1, y: bounds.y + bounds.height / 2 },
        { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height / 2 },
        { x: centerX, y: (preview.y + preview.height + title.y) / 2 },
        { x: centerX, y: preview.y + preview.height / 2 },
      ];
      for (const point of points) {
        await page.mouse.move(point.x, point.y);
        await expect(source).toHaveCSS("opacity", "1");
        expect(
          await page.evaluate(
            (point) =>
              document
                .elementFromPoint(point.x, point.y)
                ?.closest("a")
                ?.getAttribute("href"),
            point
          )
        ).toBe("/demos/001-login-standard");
      }
      const popupPromise = page.waitForEvent("popup");
      await page.mouse.click(bottom.x, bottom.y);
      const popup = await popupPromise;
      await expect(popup).toHaveURL(
        new URL("/demos/001-login-standard", baseURL).href
      );
      await popup.close();

      // Intercept the native GitHub navigation before any external request.
      const sourceURL = await source.getAttribute("href");
      if (!sourceURL) throw new Error("Missing source URL");
      await context.route(sourceURL, (route) =>
        route.fulfill({ contentType: "text/html", body: "Source link target" })
      );
      const sourcePopupPromise = page.waitForEvent("popup");
      await page.mouse.click(
        sourceBounds.x + sourceBounds.width + 8,
        sourceBounds.y + sourceBounds.height / 2
      );
      const sourcePopup = await sourcePopupPromise;
      await expect(sourcePopup).toHaveURL(sourceURL);
      await sourcePopup.close();
    } finally {
      await context.close();
    }
  });
}

for (const touch of [false, true]) {
  test(`source links have correct first-paint visibility without JavaScript on ${touch ? "touch" : "desktop"}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      hasTouch: touch,
      isMobile: touch,
      viewport: { width: 1200, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      const source = page.getByRole("link", {
        name: "View Login Standard on GitHub",
        exact: true,
      });
      await expect(source).toHaveCSS("opacity", touch ? "1" : "0");
      await page.reload();
      await expect(source).toHaveCSS("opacity", touch ? "1" : "0");
    } finally {
      await context.close();
    }
  });
}

for (const theme of ["light", "dark"]) {
  test(`hover, keyboard focus, and expanded source target work in ${theme} mode`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      theme
    );
    await page.goto("/");
    const demo = page.getByRole("link", {
      name: "Login Standard",
      exact: true,
    });
    const title = demo.locator("p");
    const source = page.getByRole("link", {
      name: "View Login Standard on GitHub",
      exact: true,
    });
    await expect(source).toHaveCSS("opacity", "0");
    const before = await sharp(await title.screenshot()).stats();
    await demo.hover();
    await expect(source).toHaveCSS("opacity", "1");
    const after = await sharp(await title.screenshot()).stats();
    // The painted glyphs must retain their color, including when a hover
    // background is present. Computed text color alone misses overlays.
    const extreme = theme === "dark" ? "max" : "min";
    for (let channel = 0; channel < 3; channel++) {
      expect(after.channels[channel][extreme]).toBe(
        before.channels[channel][extreme]
      );
    }

    await page.mouse.move(0, 0);
    await expect(source).toHaveCSS("opacity", "0");
    const cards = page.locator('[class~="group/basic-demo-page"]');
    await page
      .getByRole("button", { name: "Theme Toggle", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(demo).toBeFocused();
    await expect(cards.first()).toHaveCSS("outline-style", "solid");
    await expect(cards.first()).toHaveCSS("outline-width", "1px");
    await expect(demo).toHaveCSS("outline-style", "none");
    await expect(demo).toHaveCSS("--tw-ring-offset-width", "0px");
    await expect(source).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `zlocal/artifacts/screenshots/demo-grid-card-focus-${theme}.png`,
    });
    await page.keyboard.press("Tab");
    await expect(source).toBeFocused();
    await expect(cards.first()).toHaveCSS("outline-style", "none");
    await expect(source).toHaveCSS("outline-style", "solid");
    await expect(source).toHaveCSS("opacity", "1");

    await page.keyboard.press("Tab");
    await expect(cards.nth(1).locator('[data-slot="demo-link"]')).toBeFocused();
    await expect(cards.nth(1)).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", {
        name: "View Login Social Buttons Column Below Divider on GitHub",
        exact: true,
      })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cards.nth(1).locator('[data-slot="demo-link"]')).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(source).toBeFocused();

    const box = await source.boundingBox();
    if (!box) throw new Error("Missing GitHub link bounds");
    const target = { x: box.x + box.width + 8, y: box.y + box.height / 2 };
    expect(
      await source.evaluate((element, point) => {
        return element.contains(document.elementFromPoint(point.x, point.y));
      }, target)
    ).toBe(true);
    await expect(source).toHaveAttribute(
      "href",
      "https://github.com/aakindel/builds/tree/main/app/(pages)/demos/001-login-standard"
    );
    const preview = page.locator('img[alt="Login standard"]:visible').first();
    expect(
      await preview.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return document
          .elementFromPoint(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2
          )
          ?.closest("a")
          ?.getAttribute("href");
      })
    ).toBe("/demos/001-login-standard");
    await page.screenshot({
      path: `zlocal/artifacts/screenshots/demo-grid-links-${theme}.png`,
    });
  });
}
