import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const canonicalViewports = [
  { height: 844, name: "s-390", width: 390 },
  { height: 1024, name: "m-768", width: 768 },
  { height: 768, name: "l-1024", width: 1024 },
  { height: 900, name: "xl-1440", width: 1440 },
] as const;
const gapViewports = [
  { height: 900, width: 640 },
  { height: 900, width: 900 },
  { height: 900, width: 1200 },
] as const;

async function authenticate(context: BrowserContext, token: string) {
  await context.addCookies([{
    name: "pickflick.session_token",
    value: token,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function waitForAssets(page: Page) {
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    await Promise.all([...globalThis.document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolveImage) => {
          image.addEventListener("load", () => resolveImage(), { once: true });
          image.addEventListener("error", () => resolveImage(), { once: true });
        })));
  });
}

async function open(page: Page, route: string, viewport: { height: number; width: number }) {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "networkidle" });
  await waitForAssets(page);
}

function widths(page: Page) {
  return page.evaluate(() => ({
    body: globalThis.document.body.scrollWidth,
    client: globalThis.document.documentElement.clientWidth,
    document: globalThis.document.documentElement.scrollWidth,
  }));
}

test("protected Club onboarding redirects an unauthenticated visitor", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?returnTo=\/app$/u);
  await page.goto("/clubs/new");
  await expect(page).toHaveURL(/\/login\?returnTo=\/app$/u);
});

test("no-Clubs and Create Club have no automated accessibility violations", async ({ context, page }) => {
  await authenticate(context, "valid-accessibility");
  for (const route of ["/app", "/clubs/new"]) {
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
      await open(page, route, viewport);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
});

test("Club onboarding does not overflow across canonical and gap widths", async ({ context, page }) => {
  await authenticate(context, "valid-overflow");
  for (const route of ["/app", "/clubs/new"]) {
    for (const viewport of [...canonicalViewports, ...gapViewports]) {
      await open(page, route, viewport);
      const dimensions = await widths(page);
      expect(dimensions.document, `${route} document at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
      expect(dimensions.body, `${route} body at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.client);
    }
  }
});

test("invalid Club values stay in the form and move focus to accessible validation", async ({ context, page }) => {
  await authenticate(context, "valid-validation");
  await open(page, "/clubs/new", canonicalViewports[0]);

  const name = page.getByRole("textbox", { name: "Club name — required" });
  await name.fill("No");
  await page.getByRole("button", { name: "Create Screening Room" }).click();

  await expect(name).toHaveValue("No");
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status")).toContainText("Review the highlighted fields");
});

test("a valid Club creation opens the new Free Club with its configured scale", async ({ context, page }) => {
  await authenticate(context, "valid-create-success");
  await open(page, "/clubs/new", canonicalViewports[1]);

  await page.getByRole("textbox", { name: "Club name — required" }).fill("Midnight Society");
  await page.getByRole("textbox", { name: "Description" }).fill("Noir and classic cinema.");
  await page.getByLabel("Starts at").click();
  await page.getByRole("option", { name: "0", exact: true }).click();
  await page.getByLabel("Ends at").click();
  await page.getByRole("option", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "Create Screening Room" }).click();

  await expect(page).toHaveURL(/\/app$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Midnight Society" })).toBeVisible();
  await expect(page.getByText("Free Club")).toBeVisible();
  await expect(page.getByText("0–7")).toBeVisible();
  await expect(page.getByText("Admin", { exact: true })).toBeVisible();
});

test("the no-Clubs action meets the touch target contract", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: canonicalViewports[0] });
  try {
    await authenticate(context, "valid-touch");
    const page = await context.newPage();
    await open(page, "/app", canonicalViewports[0]);
    const create = page.getByRole("link", { name: "Create a Club" });
    expect((await create.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await create.tap();
    await expect(page).toHaveURL(/\/clubs\/new$/u);
  } finally {
    await context.close();
  }
});

for (const viewport of canonicalViewports) {
  test(`no-Clubs matches the ${viewport.name} source-comparison capture`, async ({ context, page }) => {
    await authenticate(context, `valid-no-clubs-${viewport.name}`);
    await open(page, "/app", viewport);
    await expect(page).toHaveScreenshot(`no-clubs-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });

  test(`Create Club matches the ${viewport.name} source-comparison capture`, async ({ context, page }) => {
    await authenticate(context, `valid-create-club-${viewport.name}`);
    await open(page, "/clubs/new", viewport);
    await expect(page).toHaveScreenshot(`create-club-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });
}
