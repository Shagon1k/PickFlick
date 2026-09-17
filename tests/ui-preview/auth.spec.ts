import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 844, name: "s-390", width: 390 },
  { height: 1024, name: "m-768", width: 768 },
  { height: 768, name: "l-1024", width: 1024 },
  { height: 900, name: "xl-1440", width: 1440 },
] as const;

async function openLogin(page: Page, viewport = viewports[0], route = "/login") {
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

test("Login is accessible with both approved identity providers", async ({ page }) => {
  for (const viewport of [viewports[0], viewports[3]]) {
    await openLogin(page, viewport);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome to PickFlick" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continue with Apple" })).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("Login has no horizontal overflow at canonical and bridge widths", async ({ page }) => {
  for (const viewport of [...viewports, { height: 900, name: "bridge-640", width: 640 }]) {
    await openLogin(page, viewport);
    const dimensions = await page.evaluate(() => ({
      body: globalThis.document.body.scrollWidth,
      client: globalThis.document.documentElement.clientWidth,
      document: globalThis.document.documentElement.scrollWidth,
    }));
    expect(dimensions.document, viewport.name).toBeLessThanOrEqual(dimensions.client);
    expect(dimensions.body, viewport.name).toBeLessThanOrEqual(dimensions.client);
  }
});

for (const viewport of viewports) {
  test(`Login matches the ${viewport.name} source-comparison capture`, async ({ page }) => {
    await openLogin(page, viewport);
    await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });
}

test("Google sign-in sends only an allowlisted return target and stores no token material", async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/auth/sign-in/social", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ redirect: true, url: "/login?oauth_started=1" }),
      status: 200,
    });
  });

  await openLogin(page, viewports[0], "/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/oauth_started=1/);
  expect(requestBody).toMatchObject({ callbackURL: "/app", provider: "google" });
  expect(JSON.stringify(requestBody)).not.toMatch(/token|secret/i);

  const storage = await page.evaluate(() => ({
    local: Object.keys(globalThis.localStorage),
    session: Object.keys(globalThis.sessionStorage),
  }));
  expect(storage).toEqual({ local: [], session: [] });
});

test("Apple sign-in starts the approved server-side provider flow", async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/auth/sign-in/social", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ redirect: true, url: "/login?oauth_started=apple" }),
      status: 200,
    });
  });

  await openLogin(page, viewports[0]);
  await page.getByRole("button", { name: "Continue with Apple" }).click();
  await expect(page).toHaveURL(/oauth_started=apple/);
  expect(requestBody).toMatchObject({ callbackURL: "/app", provider: "apple" });
  expect(JSON.stringify(requestBody)).not.toMatch(/token|secret/i);
});

test("Login preserves a supported invitation and never reflects raw provider errors", async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/auth/sign-in/social", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ redirect: true, url: "/login?oauth_started=1" }),
      status: 200,
    });
  });

  await openLogin(
    page,
    viewports[3],
    "/login?returnTo=%2Finvite%2Fclub%2Finvite_token-123&error=provider-secret-detail",
  );
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Sign-in could not be completed safely. Please try again.",
  );
  await expect(page.getByText("provider-secret-detail")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  expect(requestBody).toMatchObject({ callbackURL: "/invite/club/invite_token-123", provider: "google" });
});
