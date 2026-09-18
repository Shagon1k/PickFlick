import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const clubId = "10000000-0000-4000-8000-000000000031";
const route = `/clubs/${clubId}/settings`;
const canonicalViewports = [
  { height: 844, name: "s-390", width: 390 },
  { height: 1024, name: "m-768", width: 768 },
  { height: 768, name: "l-1024", width: 1024 },
  { height: 900, name: "xl-1440", width: 1440 },
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

async function open(page: Page, viewport = canonicalViewports[0]) {
  await page.setViewportSize(viewport);
  await page.goto(route, { waitUntil: "networkidle" });
  await page.evaluate(() => globalThis.document.fonts.ready);
}

test("Club settings redirects an unauthenticated visitor and withholds outsider data", async ({ context, page }) => {
  await page.goto(route);
  await expect(page).toHaveURL(/\/login\?returnTo=\/app$/u);

  await authenticate(context, "valid-settings-outsider");
  await page.goto(route);
  await expect(page.getByRole("heading", { name: "Club access unavailable" })).toBeVisible();
  await expect(page.getByText("Midnight Society")).toHaveCount(0);
});

test("Admin and Member settings states have no automated accessibility violations", async ({ context, page }) => {
  for (const token of ["valid-settings-admin", "valid-settings-member"]) {
    await authenticate(context, token);
    for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
      await open(page, viewport);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
});

test("Club settings do not overflow across canonical and bridge widths", async ({ context, page }) => {
  await authenticate(context, "valid-settings-admin-overflow");
  for (const viewport of [
    ...canonicalViewports,
    { height: 900, name: "bridge-640", width: 640 },
    { height: 900, name: "bridge-900", width: 900 },
    { height: 900, name: "bridge-1200", width: 1200 },
  ]) {
    await open(page, viewport);
    const widths = await page.evaluate(() => ({
      body: globalThis.document.body.scrollWidth,
      client: globalThis.document.documentElement.clientWidth,
      document: globalThis.document.documentElement.scrollWidth,
    }));
    expect(widths.document, `${viewport.name} document`).toBeLessThanOrEqual(widths.client);
    expect(widths.body, `${viewport.name} body`).toBeLessThanOrEqual(widths.client);
  }
});

test("Admin can submit settings, change a role, and confirm archive", async ({ context, page }) => {
  await authenticate(context, "valid-settings-admin-actions");
  await open(page, canonicalViewports[2]);

  const name = page.getByRole("textbox", { name: "Club name" });
  await name.fill("Midnight Society Updated");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Club settings saved.")).toBeVisible();

  await page.getByLabel("Role for Morgan Member").selectOption("MODERATOR");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText("Member role updated.")).toBeVisible();

  await page.getByRole("button", { name: "Archive Club" }).click();
  const dialog = page.getByRole("dialog", { name: "Archive this Club?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Type ARCHIVE to confirm" }).fill("ARCHIVE");
  await dialog.getByRole("button", { name: "Confirm archive club" }).click();
  await expect(dialog.getByText("Club archived.")).toBeVisible();
});

test("avatar replacements refresh the image and removal keeps the latest status", async ({ context, page }) => {
  await authenticate(context, "valid-settings-admin-avatar-actions");
  await open(page, canonicalViewports[2]);

  const avatarInput = page.getByLabel("Club avatar");
  const upload = async () => {
    await avatarInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Club avatar updated.")).toBeVisible();
  };

  await upload();
  const avatar = page.getByRole("img", { name: "Midnight Society avatar" });
  await expect(avatar).toHaveAttribute("src", /\?v=avatar-1$/u);

  await upload();
  await expect(avatar).toHaveAttribute("src", /\?v=avatar-2$/u);

  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByText("Club avatar removed.")).toBeVisible();
  await expect(avatar).toHaveCount(0);
});

test("Member sees read-only controls and can confirm leaving", async ({ context, page }) => {
  await authenticate(context, "valid-settings-member-actions");
  await open(page);
  await expect(page.getByRole("textbox", { name: "Club name" })).toBeDisabled();
  await expect(page.getByLabel("Role for Morgan Member")).toBeDisabled();
  await page.getByRole("button", { name: "Leave Club" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave this Club?" });
  await dialog.getByRole("textbox", { name: "Type LEAVE to confirm" }).fill("LEAVE");
  await dialog.getByRole("button", { name: "Confirm leave club" }).click();
  await expect(page).toHaveURL(/\/app$/u);
});

for (const viewport of canonicalViewports) {
  test(`Club Admin settings match the ${viewport.name} source-comparison capture`, async ({ context, page }) => {
    await authenticate(context, `valid-settings-admin-${viewport.name}`);
    await open(page, viewport);
    await expect(page).toHaveScreenshot(`club-settings-admin-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });
}

for (const viewport of [canonicalViewports[0], canonicalViewports[3]]) {
  test(`Club Member settings match the ${viewport.name} source-comparison capture`, async ({ context, page }) => {
    await authenticate(context, `valid-settings-member-${viewport.name}`);
    await open(page, viewport);
    await expect(page).toHaveScreenshot(`club-settings-member-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });

  test(`Archived Club settings match the ${viewport.name} source-comparison capture`, async ({ context, page }) => {
    await authenticate(context, `valid-settings-archived-${viewport.name}`);
    await open(page, viewport);
    await expect(page).toHaveScreenshot(`club-settings-archived-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      scale: "css",
    });
  });
}
