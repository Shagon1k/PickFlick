import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const shellRoutes = ["public", "setup", "product", "session", "settings", "library", "admin"] as const;
const canonicalViewports = [
  { height: 844, name: "s-390", width: 390 },
  { height: 1024, name: "m-768", width: 768 },
  { height: 768, name: "l-1024", width: 1024 },
  { height: 900, name: "xl-1440", width: 1440 },
] as const;
const gapViewports = [
  { height: 900, name: "s-to-m-640", width: 640 },
  { height: 900, name: "m-to-l-900", width: 900 },
  { height: 900, name: "l-to-xl-1200", width: 1200 },
] as const;

async function openShell(page: Page, shell: (typeof shellRoutes)[number], viewport: { height: number; width: number }) {
  await page.setViewportSize(viewport);
  await page.goto(`/shell-preview/${shell}`, { waitUntil: "networkidle" });
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

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary ?? node.html}`)
          .join("\n")}`,
    )
    .join("\n");
}

for (const shell of shellRoutes) {
  test(`${shell} shell has no automated accessibility violations`, async ({ page }) => {
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
      await openShell(page, shell, viewport);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `${shell} at ${viewport.name}\n${formatViolations(results.violations)}`).toEqual([]);
    }
  });

  test(`${shell} shell contains page overflow across canonical and gap widths`, async ({ page }) => {
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
      await openShell(page, shell, viewport);
      const dimensions = await page.evaluate(() => ({
        body: globalThis.document.body.scrollWidth,
        client: globalThis.document.documentElement.clientWidth,
        document: globalThis.document.documentElement.scrollWidth,
      }));
      expect(dimensions.document, `${shell} document at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
      expect(dimensions.body, `${shell} body at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
    }
  });

  for (const viewport of canonicalViewports) {
    test(`${shell} shell matches the ${viewport.name} source-comparison capture`, async ({ page }) => {
      await openShell(page, shell, viewport);
      await expect(page).toHaveScreenshot(`shell-${shell}-${viewport.name}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
        scale: "css",
      });
    });
  }
}

test("header overlays are mutually exclusive and return focus", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[2]);

  const searchTrigger = page.getByRole("button", { name: "Search films" });
  const alertsTrigger = page.getByRole("button", { name: "Alerts" });
  await searchTrigger.click();
  await expect(page.locator("#shell-search-overlay")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search films" })).toBeFocused();

  await alertsTrigger.click();
  await expect(page.locator("#shell-search-overlay")).toHaveCount(0);
  await expect(page.locator("#shell-notifications-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#shell-notifications-overlay")).toHaveCount(0);
  await expect(alertsTrigger).toBeFocused();
});

test("mobile product menus are exclusive, keyboard dismissible, and touch sized", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[0]);

  const mobileNavigation = page.getByRole("navigation", { name: "Mobile product navigation" });
  const hubTrigger = mobileNavigation.getByRole("button", { name: "Hub" });
  const libraryTrigger = mobileNavigation.getByRole("button", { name: "Library" });
  await hubTrigger.click();
  await expect(page.getByRole("navigation", { name: "Hub sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toBeFocused();

  await libraryTrigger.click();
  await expect(page.getByRole("navigation", { name: "Hub sections" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Library sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Ratings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(libraryTrigger).toBeFocused();

  for (const control of await mobileNavigation.locator(":scope > div > button, :scope > div > a").all()) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});

test("visible shell controls keep 44px targets and a visible keyboard focus", async ({ page }) => {
  for (const shell of shellRoutes) {
    await openShell(page, shell, canonicalViewports[0]);
    const controls = page.locator("a[href]:visible, button:visible, input:visible");
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box?.height, `${shell}: ${await control.evaluate((element) => element.outerHTML)}`).toBeGreaterThanOrEqual(44);
    }
  }

  await openShell(page, "public", canonicalViewports[0]);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  const focusTreatment = await focused.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(
    focusTreatment.boxShadow !== "none" ||
      (focusTreatment.outlineStyle !== "none" && focusTreatment.outlineWidth !== "0px"),
  ).toBe(true);
});

test("public and section mobile menus focus their first item and return focus", async ({ page }) => {
  await openShell(page, "public", canonicalViewports[0]);
  const publicTrigger = page.getByRole("button", { name: "Menu" });
  await publicTrigger.click();
  await expect(page.getByRole("navigation", { name: "Public mobile navigation" }).getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(publicTrigger).toBeFocused();

  await openShell(page, "settings", canonicalViewports[0]);
  const sectionTrigger = page.getByRole("button", { name: /Settings sections Profile/ });
  await sectionTrigger.click();
  await expect(page.getByRole("navigation", { name: "Settings sections mobile" }).getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sectionTrigger).toBeFocused();
});

test("dense regions scroll locally without widening the page", async ({ page }) => {
  for (const shell of ["library", "admin"] as const) {
    await openShell(page, shell, canonicalViewports[0]);
    const region = page.getByRole("region", { name: shell === "library" ? "Library results preview" : "Administration results preview" });
    const widths = await region.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    expect(widths.scroll).toBeGreaterThan(widths.client);
    await region.focus();
    await page.keyboard.press("ArrowRight");
    expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  }
});

test("shell motion collapses under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openShell(page, "product", canonicalViewports[0]);
  await page.getByRole("navigation", { name: "Mobile product navigation" }).getByRole("button", { name: "Hub" }).click();
  const duration = await page.getByRole("navigation", { name: "Hub sections" }).evaluate((element) =>
    Number.parseFloat(element.parentElement ? globalThis.getComputedStyle(element.parentElement).animationDuration : "0"),
  );
  expect(duration).toBeLessThanOrEqual(0.001);
});
