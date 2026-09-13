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
  await page.getByRole("button", { name: "Close search" }).click();
  await expect(searchTrigger).toBeFocused();

  await alertsTrigger.click();
  await expect(page.locator("#shell-search-overlay")).toHaveCount(0);
  await expect(page.locator("#shell-notifications-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#shell-notifications-overlay")).toHaveCount(0);
  await expect(alertsTrigger).toBeFocused();

  await searchTrigger.click();
  const searchOverlay = page.locator("#shell-search-overlay");
  await searchOverlay.evaluate(async (element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  const searchBox = await searchOverlay.boundingBox();
  expect(searchBox?.x).toBe(0);
  expect(searchBox?.y).toBe(0);
  expect(searchBox?.width).toBe(canonicalViewports[2].width);
});

test("mobile product menus stay in view, dismiss outside, and share the Alerts overlay", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[0]);

  const mobileNavigation = page.getByRole("navigation", { name: "Mobile product navigation" });
  const hubTrigger = mobileNavigation.getByRole("button", { name: "Hub" });
  const libraryTrigger = mobileNavigation.getByRole("button", { name: "Library" });
  const alertsTrigger = mobileNavigation.getByRole("button", { name: "Alerts" });
  const settingsTrigger = mobileNavigation.getByRole("button", { name: "Settings" });
  await hubTrigger.click();
  await expect(page.getByRole("navigation", { name: "Hub sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Overview" })).toBeFocused();

  const hubBox = await page.locator("[data-mobile-menu=hub]").boundingBox();
  expect(hubBox?.x).toBeGreaterThanOrEqual(0);
  expect((hubBox?.x ?? 0) + (hubBox?.width ?? 0)).toBeLessThanOrEqual(canonicalViewports[0].width);

  await page.getByRole("heading", { name: "Club context" }).click();
  await expect(page.getByRole("navigation", { name: "Hub sections" })).toHaveCount(0);

  await libraryTrigger.click();
  await expect(page.getByRole("navigation", { name: "Library sections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Ratings" })).toBeFocused();

  await alertsTrigger.click();
  await expect(page.getByRole("navigation", { name: "Library sections" })).toHaveCount(0);
  await expect(page.locator("#shell-notifications-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeFocused();

  await settingsTrigger.click();
  await expect(page.locator("#shell-notifications-overlay")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible();
  const settingsBox = await page.locator("[data-mobile-menu=settings]").boundingBox();
  expect(settingsBox?.x).toBeGreaterThanOrEqual(0);
  expect((settingsBox?.x ?? 0) + (settingsBox?.width ?? 0)).toBeLessThanOrEqual(canonicalViewports[0].width);

  await page.keyboard.press("Escape");
  await expect(settingsTrigger).toBeFocused();

  for (const control of await mobileNavigation.locator(":scope > div > button, :scope > div > a").all()) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  const mobileIcons = await mobileNavigation.locator(":scope > div > button svg").evaluateAll((icons) =>
    icons.map((icon) => icon.innerHTML),
  );
  expect(new Set(mobileIcons).size).toBe(mobileIcons.length);
});

test("public legal links use distinct canonical destinations", async ({ page }) => {
  await openShell(page, "public", canonicalViewports[2]);
  await expect(page.getByRole("navigation", { exact: true, name: "Public navigation" }).getByRole("link", { name: "How it works" })).toHaveAttribute(
    "href",
    "/shell-preview/public#public-content",
  );
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
});

test("product primary action opens the Session destination", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[2]);
  const primaryAction = page.getByRole("link", { name: "Primary action" });
  await expect(primaryAction).toHaveAttribute("href", "/shell-preview/session");
  await primaryAction.click();
  await expect(page).toHaveURL(/\/shell-preview\/session$/);
  await expect(page.getByRole("heading", { name: "Film and Session context" })).toBeVisible();
});

test("Library and Settings menus expose distinct subsection destinations", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[0]);
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile product navigation" });

  await mobileNavigation.getByRole("button", { name: "Library" }).click();
  const libraryLinks = page.getByRole("navigation", { name: "Library sections" }).getByRole("link");
  await expect(libraryLinks).toHaveCount(3);
  expect(new Set(await libraryLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).size).toBe(3);

  await mobileNavigation.getByRole("button", { name: "Settings" }).click();
  const settingsNavigation = page.getByRole("navigation", { name: "Settings sections" });
  const settingsLinks = settingsNavigation.getByRole("link");
  await expect(settingsLinks).toHaveCount(3);
  expect(new Set(await settingsLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).size).toBe(3);
  await expect(settingsNavigation.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/shell-preview/settings?tab=privacy");
});

test("Club and Admin section navigation exposes distinct destinations and current state", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[2]);
  const clubNavigation = page.getByRole("navigation", { name: "Club sections" });
  const clubLinks = clubNavigation.getByRole("link");
  await expect(clubLinks).toHaveCount(6);
  expect(new Set(await clubLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).size).toBe(6);
  await expect(clubNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

  await openShell(page, "product", canonicalViewports[0]);
  const hubTrigger = page.getByRole("navigation", { name: "Mobile product navigation" }).getByRole("button", { name: "Hub" });
  await hubTrigger.click();
  const hubLinks = page.getByRole("navigation", { name: "Hub sections" }).getByRole("link");
  await expect(hubLinks).toHaveCount(6);
  await expect(page.getByRole("link", { name: "Achievements" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Club" })).toBeVisible();

  await openShell(page, "admin", canonicalViewports[2]);
  const adminNavigation = page.getByRole("complementary", { name: "Admin sections" }).getByRole("navigation");
  const adminLinks = adminNavigation.getByRole("link");
  await expect(adminLinks).toHaveCount(4);
  expect(new Set(await adminLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).size).toBe(4);
  await expect(adminNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");

  await openShell(page, "admin", canonicalViewports[0]);
  await page.getByRole("navigation", { name: "Mobile product navigation" }).getByRole("button", { name: "Admin" }).click();
  const mobileAdminLinks = page.getByRole("navigation", { name: "Admin sections" }).getByRole("link");
  await expect(mobileAdminLinks).toHaveCount(4);
  expect(new Set(await mobileAdminLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).size).toBe(4);
});

test("App Admin capability is preserved on admin and non-admin shells", async ({ page }) => {
  await openShell(page, "session", canonicalViewports[2]);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", { name: "Admin Panel" })).toHaveCount(0);

  await openShell(page, "product", canonicalViewports[2]);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", { name: "Admin Panel" })).toBeVisible();

  await openShell(page, "product", canonicalViewports[0]);
  await expect(page.getByRole("navigation", { name: "Mobile product navigation" }).getByRole("link", { name: "Admin" })).toHaveAttribute(
    "href",
    "/shell-preview/admin",
  );
});

test("authenticated shells expose Sign out as an action on desktop and mobile", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[2]);
  await page.getByRole("button", { name: "Account menu" }).click();
  const desktopAction = page.getByRole("navigation", { name: "Account navigation" }).getByRole("button", { name: "Sign out" });
  await expect(desktopAction).toHaveAttribute("data-shell-action", "sign-out");

  await openShell(page, "settings", canonicalViewports[0]);
  await page.getByRole("navigation", { name: "Mobile product navigation" }).getByRole("button", { name: "Settings" }).click();
  const mobileAction = page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Sign out" });
  await expect(mobileAction).toHaveAttribute("data-shell-action", "sign-out");
});

test("compact and Session headers match their canonical navigation variants", async ({ page }) => {
  await openShell(page, "product", canonicalViewports[1]);
  await expect(page.getByRole("navigation", { exact: true, name: "Product navigation" })).toBeHidden();
  const compactHeader = page.locator("header");
  await expect(compactHeader.getByRole("button", { name: "Alerts" })).toBeHidden();
  await expect(compactHeader.getByRole("button", { name: "Account menu" })).toBeHidden();
  await expect(page.getByRole("link", { name: "PickFlick home" })).toContainText("PickFlick");

  await openShell(page, "session", canonicalViewports[2]);
  await expect(page.getByRole("navigation", { exact: true, name: "Product navigation" }).getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to Hub" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Back to Hub" })).toHaveAttribute("href", "/shell-preview/product");
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

test("section menus share the product overlay state", async ({ page }) => {
  await openShell(page, "settings", canonicalViewports[0]);
  const sectionTrigger = page.getByRole("button", { name: /Settings sections Profile/ });
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile product navigation" });

  await sectionTrigger.click();
  await expect(page.getByRole("navigation", { name: "Settings sections mobile" })).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Alerts" }).click();
  await expect(page.getByRole("navigation", { name: "Settings sections mobile" })).toHaveCount(0);
  await expect(page.locator("#shell-notifications-overlay")).toBeVisible();

  await sectionTrigger.click();
  await expect(page.locator("#shell-notifications-overlay")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Settings sections mobile" })).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Library" }).click();
  await expect(page.getByRole("navigation", { name: "Settings sections mobile" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Library sections" })).toBeVisible();
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
