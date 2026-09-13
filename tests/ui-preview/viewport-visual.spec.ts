import { expect, test, type Page } from "@playwright/test";

const canonicalViewports = [
  { height: 844, name: "s-390", width: 390 },
  { height: 1024, name: "m-768", width: 768 },
  { height: 768, name: "l-1024", width: 1024 },
  { height: 900, name: "xl-1440", width: 1440 },
] as const;

const fluidGapViewports = [
  { height: 900, name: "s-to-m-640", width: 640 },
  { height: 900, name: "m-to-l-900", width: 900 },
  { height: 900, name: "l-to-xl-1200", width: 1200 },
] as const;

async function openStablePreview(page: Page, viewport: { height: number; width: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/ui-preview", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    await Promise.all(
      [...globalThis.document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolveImage) => {
              image.addEventListener("load", () => resolveImage(), { once: true });
              image.addEventListener("error", () => resolveImage(), { once: true });
            }),
      ),
    );
  });
}

for (const profile of [...canonicalViewports, ...fluidGapViewports]) {
  test(`has no horizontal page overflow at ${profile.name}`, async ({ page }) => {
    await openStablePreview(page, profile);

    const dimensions = await page.evaluate(() => ({
      bodyWidth: globalThis.document.body.scrollWidth,
      clientWidth: globalThis.document.documentElement.clientWidth,
      documentWidth: globalThis.document.documentElement.scrollWidth,
    }));

    expect(dimensions.documentWidth, `document overflowed at ${profile.width}px`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    );
    expect(dimensions.bodyWidth, `body overflowed at ${profile.width}px`).toBeLessThanOrEqual(
      dimensions.clientWidth,
    );
  });
}

for (const profile of canonicalViewports) {
  test(`matches the ${profile.name} visual baseline`, async ({ page }) => {
    await openStablePreview(page, profile);

    await expect(page).toHaveScreenshot(`ui-preview-${profile.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });
}

test("collapses decorative motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStablePreview(page, canonicalViewports[0]);
  await page.getByRole("button", { name: "Open Club menu" }).click();

  const motion = await page.getByRole("menu", { name: "Club menu" }).evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      animationDuration: Number.parseFloat(style.animationDuration),
      transitionDuration: Number.parseFloat(style.transitionDuration),
    };
  });

  expect(motion.animationDuration).toBeLessThanOrEqual(0.001);
  expect(motion.transitionDuration).toBeLessThanOrEqual(0.001);
});
