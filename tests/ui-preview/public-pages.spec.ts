import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pages = [
  { name: "landing", route: "/" },
  { name: "pricing", route: "/pricing" },
] as const;
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

async function openPage(
  page: Page,
  route: string,
  viewport: { height: number; width: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "networkidle" });
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

for (const publicPage of pages) {
  test(`${publicPage.name} has no automated accessibility violations`, async ({ page }) => {
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
      await openPage(page, publicPage.route, viewport);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations,
        `${publicPage.name} at ${viewport.name}\n${formatViolations(results.violations)}`,
      ).toEqual([]);
    }
  });

  test(`${publicPage.name} has no page overflow across canonical and gap widths`, async ({ page }) => {
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
      await openPage(page, publicPage.route, viewport);
      const dimensions = await page.evaluate(() => ({
        body: globalThis.document.body.scrollWidth,
        client: globalThis.document.documentElement.clientWidth,
        document: globalThis.document.documentElement.scrollWidth,
      }));
      expect(dimensions.document, `${publicPage.name} document at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
      expect(dimensions.body, `${publicPage.name} body at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
    }
  });

  for (const viewport of canonicalViewports) {
    test(`${publicPage.name} matches the ${viewport.name} source-comparison capture`, async ({ page }) => {
      await openPage(page, publicPage.route, viewport);
      await expect(page).toHaveScreenshot(`${publicPage.name}-${viewport.name}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
        scale: "css",
      });
    });
  }
}

test("landing calls to action and public navigation use canonical destinations", async ({ page }) => {
  await openPage(page, "/", canonicalViewports[3]);

  await expect(page.getByRole("link", { name: "Start your first Club" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "#how");
  await expect(page.getByRole("navigation", { exact: true, name: "Public navigation" }).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
});

test("pricing publishes corrected limits and keeps checkout unavailable", async ({ page }) => {
  await openPage(page, "/pricing", canonicalViewports[3]);

  const publicNavigation = page.getByRole("navigation", { exact: true, name: "Public navigation" });
  await expect(publicNavigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");

  const upgrade = page.getByRole("button", { name: "Upgrade unavailable" });
  await expect(upgrade).toBeDisabled();
  await expect(page.getByText("Pro checkout opens in the Paddle billing phase.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Blocking Sessions per Club 1 1/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Price €0 €5 \/ month/ })).toBeVisible();
  await expect(page.getByText("Unlimited nomination rounds")).toHaveCount(0);
});

test("pricing comparison scroll stays local on mobile", async ({ page }) => {
  await openPage(page, "/pricing", canonicalViewports[0]);
  const scrollRegion = page.getByRole("region", { name: "Plan comparison scroll region" });
  const dimensions = await scrollRegion.evaluate((element) => ({
    client: element.clientWidth,
    overflowX: globalThis.getComputedStyle(element).overflowX,
    scroll: element.scrollWidth,
  }));

  expect(dimensions.overflowX).toBe("auto");
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
});

test("pricing FAQ expands, collapses, and preserves focus", async ({ page }) => {
  await openPage(page, "/pricing", canonicalViewports[0]);
  const firstQuestion = page.getByRole("button", { name: "Can I switch plans anytime?" });
  const secondQuestion = page.getByRole("button", { name: "What happens when I downgrade?" });

  await expect(firstQuestion).toHaveAttribute("aria-expanded", "true");
  await secondQuestion.click();
  await expect(secondQuestion).toBeFocused();
  await expect(secondQuestion).toHaveAttribute("aria-expanded", "true");
  await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/Pro features remain active until the paid billing period ends/)).toBeVisible();

  await secondQuestion.click();
  await expect(secondQuestion).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/Pro features remain active until the paid billing period ends/)).toBeHidden();
});

test("pricing FAQ removes decorative motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, "/pricing", canonicalViewports[0]);
  await page.getByRole("button", { name: "What happens when I downgrade?" }).click();
  const answer = page.getByRole("region", { name: "What happens when I downgrade?" });

  expect(await answer.evaluate((element) => globalThis.getComputedStyle(element).animationName)).toBe("none");
});
