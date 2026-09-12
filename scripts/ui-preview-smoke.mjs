import assert from "node:assert/strict";

import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";

async function assertVisibleFocus(locator, label) {
  const focusStyle = await locator.evaluate((element) => {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return {
      boxShadow: style?.boxShadow,
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: style?.outlineStyle,
      outlineWidth: style?.outlineWidth,
    };
  });
  assert.equal(focusStyle.focusVisible, true, `${label} must match :focus-visible`);
  assert.ok(
    (focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth !== "0px") || focusStyle.boxShadow !== "none",
    `${label} must render a visible focus treatment`,
  );
}

const baseUrl = process.argv.slice(2).find((argument) => argument !== "--") ?? "http://127.0.0.1:3000";
const previewUrl = new URL("/ui-preview", baseUrl).toString();
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(previewUrl, { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "dark");

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  assert.equal(
    accessibilityResults.violations.length,
    0,
    `accessibility violations:\n${accessibilityResults.violations
      .map((violation) =>
        `${violation.id} (${violation.impact ?? "unknown impact"}): ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary ?? node.html}`)
          .join("\n")}`,
      )
      .join("\n")}`,
  );

  const namedField = page.getByRole("textbox", { name: "Club name", exact: true });
  await expect(namedField).toHaveAttribute("aria-describedby", "club-name-message");
  await expect(page.locator("#club-name-message")).toHaveText("Shown to every Club member.");
  const emptyMessage = page.locator("#session-note-message");
  await expect(emptyMessage).toBeAttached();
  assert.ok(
    (await emptyMessage.evaluate((element) => element.getBoundingClientRect().height)) > 0,
    "empty field message must reserve layout space",
  );

  const asyncField = page.locator("#async-club-name").locator("xpath=ancestor::*[contains(@class, 'pf-field')]");
  const errorAnnouncement = asyncField.locator('[data-field-live="error"]');
  const successAnnouncement = asyncField.locator('[data-field-live="success"]');
  await expect(errorAnnouncement).toBeAttached();
  await expect(successAnnouncement).toBeAttached();
  await expect(errorAnnouncement).toBeEmpty();
  await expect(successAnnouncement).toBeEmpty();
  await page.getByRole("button", { name: "Show async error" }).click();
  await expect(page.locator("#async-club-name-message")).toHaveText("Club name could not be saved.");
  await expect(errorAnnouncement).toHaveText("Club name could not be saved.");
  await expect(successAnnouncement).toBeEmpty();
  await page.getByRole("button", { name: "Show async success" }).click();
  await expect(page.locator("#async-club-name-message")).toHaveText("Club name saved.");
  await expect(errorAnnouncement).toBeEmpty();
  await expect(successAnnouncement).toHaveText("Club name saved.");

  const select = page.getByRole("combobox", { name: "Selection range", exact: true });
  await select.focus();
  await page.keyboard.press("Enter");
  await assertVisibleFocus(select, "select");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(select).toHaveValue("1 to 5");
  await expect(page.locator('input[type="hidden"][name="score-range"]')).toHaveValue("1-5");

  const requiredForm = page.getByRole("form", { name: "Required select form" });
  const requiredSelect = page.getByRole("combobox", { name: "Required selection range" });
  const constraintInput = requiredForm.locator('input[name="required-range"]');
  await expect(constraintInput).toHaveAttribute("type", "text");
  await expect(constraintInput).toHaveAttribute("required", "");
  await requiredForm.getByRole("button", { name: "Submit required select" }).click();
  await expect(requiredForm.locator("[data-submitted-value]")).toHaveText("Not submitted");
  await expect(requiredSelect).toBeFocused();
  await expect(requiredSelect).toHaveAttribute("aria-invalid", "true");
  assert.equal(await constraintInput.evaluate((element) => element.matches(":invalid")), true);
  await requiredSelect.click();
  await page.getByRole("option", { name: "0 to 4" }).click();
  await requiredForm.getByRole("button", { name: "Submit required select" }).click();
  await expect(requiredForm.locator("[data-submitted-value]")).toHaveText("0-4");
  assert.equal(await constraintInput.evaluate((element) => element.matches(":valid")), true);

  const overviewTab = page.getByRole("tab", { name: "Overview" });
  const sessionsTab = page.getByRole("tab", { name: "Sessions" });
  await overviewTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(sessionsTab).toBeFocused();
  await assertVisibleFocus(sessionsTab, "tab");
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(sessionsTab).toHaveAttribute("aria-selected", "true");

  const changingTabs = page.getByRole("tablist", { name: "Changing views" });
  const firstChangingTab = changingTabs.getByRole("tab", { name: "First enabled" });
  const selectedChangingTab = changingTabs.getByRole("tab", { name: "Selected tab" });
  await expect(selectedChangingTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Disable selected tab" }).click();
  await expect(selectedChangingTab).toBeDisabled();
  await expect(firstChangingTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Enable selected tab" }).click();
  await selectedChangingTab.click();
  await expect(selectedChangingTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Remove selected tab" }).click();
  await expect(selectedChangingTab).toHaveCount(0);
  await expect(firstChangingTab).toHaveAttribute("aria-selected", "true");

  const clubTrigger = page.getByRole("button", { name: "Open Club menu" });
  const accountTrigger = page.getByRole("button", { name: "Open account menu" });
  await clubTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Club menu" })).toBeVisible();
  const firstClubMenuItem = page.getByRole("menuitem", { name: "Overview" });
  await expect(firstClubMenuItem).toBeFocused();
  await assertVisibleFocus(firstClubMenuItem, "menu item");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(accountTrigger).toBeFocused();
  await expect(page.getByRole("menu", { name: "Club menu" })).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
  await expect(page.getByRole("menu", { name: "Club menu" })).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(accountTrigger).toBeFocused();

  const adjustableScale = page.getByRole("radiogroup", { name: "Adjustable score" });
  const adjustableFieldset = adjustableScale.locator("xpath=ancestor::fieldset");
  await expect(adjustableFieldset.locator("output")).toHaveText("5 of 5");
  await page.getByRole("button", { name: "Reduce adjustable scale" }).click();
  await expect(adjustableFieldset.locator("output")).toHaveText("Not selected");
  await expect(page.locator('input[type="hidden"][name="adjustable-score"]')).toHaveValue("");
  await expect(adjustableScale.locator('[aria-checked="true"]')).toHaveCount(0);
  const firstAdjustableOption = adjustableScale.getByRole("radio", { name: "1 of 4" });
  await firstAdjustableOption.focus();
  await expect(firstAdjustableOption).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Tab");
  await expect(firstAdjustableOption).not.toHaveAttribute("data-active", "true");

  const dialogTrigger = page.getByRole("button", { name: "Open dialog" });
  await dialogTrigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Move to Selection?" });
  await expect(dialog).toBeVisible();
  const dialogClose = page.getByRole("button", { name: "Close dialog" });
  await expect(dialogClose).toBeFocused();
  await assertVisibleFocus(dialogClose, "dialog close button");
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate((element) => element.contains(element.ownerDocument.activeElement)), true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(dialogTrigger).toBeFocused();

  await clubTrigger.click();
  const targetLocators = [
    page.getByRole("tab", { name: "Overview" }),
    page.getByRole("combobox", { name: "Selection range", exact: true }),
    clubTrigger,
    page.getByRole("menuitem", { name: "Overview" }),
    firstAdjustableOption,
  ];
  for (const locator of targetLocators) {
    assert.ok(
      (await locator.evaluate((element) => element.getBoundingClientRect().height)) >= 44,
      "interactive target must be at least 44px high",
    );
  }
  assert.equal(
    await select.evaluate((element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor),
    "rgb(22, 22, 22)",
  );
  assert.equal(
    await page
      .getByRole("menu", { name: "Club menu" })
      .evaluate((element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor),
    "rgb(12, 12, 12)",
  );

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.emulateMedia({ reducedMotion: "reduce" });
  await reducedPage.goto(previewUrl, { waitUntil: "networkidle" });
  await reducedPage.getByRole("button", { name: "Open Club menu" }).click();
  const animationDuration = await reducedPage
    .getByRole("menu", { name: "Club menu" })
    .evaluate((element) =>
      Number.parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).animationDuration ?? "0"),
    );
  assert.ok(animationDuration <= 0.001, "reduced motion must collapse menu animation duration");
  await reducedContext.close();

  assert.deepEqual(browserErrors, [], `browser errors: ${browserErrors.join(" | ")}`);
  console.log("UI preview smoke passed: axe, form constraints, live feedback, dynamic tabs, keyboard, overlays, targets, theme, and motion.");
  await context.close();
} finally {
  await browser.close();
}
