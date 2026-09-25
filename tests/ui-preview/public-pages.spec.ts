import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pages = [
  { name: "landing", route: "/" },
  { name: "pricing", route: "/pricing" },
  { name: "contact", route: "/contact" },
  { name: "privacy", route: "/legal/privacy" },
  { name: "terms", route: "/legal/terms" },
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
      if (publicPage.name === "landing") {
        const heroContent = page.locator("main section").first().locator(":scope > div:last-child");
        await expect.poll(() => heroContent.evaluate((element) => globalThis.getComputedStyle(element).opacity)).toBe("1");
      }
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

      if (publicPage.name === "landing") {
        for (const section of await page.locator("main section").all()) {
          await section.scrollIntoViewIfNeeded();
        }
        await page.evaluate(() => globalThis.scrollTo(0, 0));
      }

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
  const publicNavigation = page.getByRole("navigation", { exact: true, name: "Public navigation" });
  await expect(publicNavigation.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how");
  await expect(publicNavigation.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#features");
  await expect(publicNavigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  await expect(publicNavigation.getByRole("link", { name: "Contact" })).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "Go to App" })).toHaveAttribute("href", "/app");
  await expect(page.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");
});

test("public header keeps only the app entry through tablet without a bottom menu", async ({ page }) => {
  for (const viewport of [canonicalViewports[0], canonicalViewports[1]]) {
    await openPage(page, "/", viewport);
    const publicNavigation = page.getByRole("navigation", { exact: true, name: "Public navigation", includeHidden: true });

    await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
    await expect(publicNavigation).toBeHidden();
    await expect(page.getByRole("link", { name: "Compare plans" })).toHaveAttribute("href", "/pricing");

    const appEntry = await page.getByRole("banner").getByRole("link", { name: "Go to App" }).boundingBox();
    expect(appEntry?.height).toBeGreaterThanOrEqual(44);
    expect(appEntry?.width).toBeLessThan(viewport.width / 2);
  }

  await openPage(page, "/", { height: 900, width: 821 });
  const publicNavigation = page.getByRole("navigation", { exact: true, name: "Public navigation" });
  await expect(publicNavigation.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(publicNavigation.getByRole("link", { name: "Features" })).toBeVisible();
  await expect(publicNavigation.getByRole("link", { name: "Pricing" })).toBeVisible();
});

test("legal entries expose distinct provisional documents and public contact", async ({ page }) => {
  for (const legalPage of [
    { heading: "Privacy Notice", route: "/legal/privacy" },
    { heading: "Terms of Service", route: "/legal/terms" },
  ]) {
    await openPage(page, legalPage.route, canonicalViewports[3]);

    await expect(page.getByRole("heading", { level: 1, name: legalPage.heading })).toBeVisible();
    await expect(page.getByText("Draft for review")).toBeVisible();
    await expect(page.getByText(/final production policy are still pending/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@pick-flick.app" })).toHaveAttribute(
      "href",
      "mailto:hello@pick-flick.app",
    );
  }
});

test("landing content remains visible when JavaScript is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: canonicalViewports[3] });
  const page = await context.newPage();

  try {
    await page.goto("/", { waitUntil: "networkidle" });
    const revealState = await page.locator("main > div").getAttribute("data-reveal");
    const opacity = await page.locator("#features").evaluate((element) => globalThis.getComputedStyle(element).opacity);

    expect(revealState).toBeNull();
    expect(opacity).toBe("1");
  } finally {
    await context.close();
  }
});

test("landing reveals scene sections on scroll and removes reveal motion when requested", async ({ page }) => {
  await openPage(page, "/", canonicalViewports[3]);
  const promise = page.getByRole("region", { name: "PickFlick promise" });

  await expect(page.locator('main > div[data-reveal="enabled"]')).toHaveCount(1);
  await expect.poll(() => promise.evaluate((element) => globalThis.getComputedStyle(element).opacity)).toBe("0");
  await promise.scrollIntoViewIfNeeded();
  await expect.poll(() => promise.evaluate((element) => globalThis.getComputedStyle(element).opacity)).toBe("1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page, "/", canonicalViewports[3]);
  const reducedMotionStyles = await promise.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      opacity: style.opacity,
      transform: style.transform,
      transitionDuration: Number.parseFloat(style.transitionDuration),
    };
  });
  expect(reducedMotionStyles).toMatchObject({ opacity: "1", transform: "none" });
  expect(reducedMotionStyles.transitionDuration).toBeLessThanOrEqual(0.001);
});

test("landing preserves heading scale and the S feature composition through the responsive bridge", async ({ page }) => {
  await openPage(page, "/", { height: 900, width: 575 });
  const headingAt575 = await page.getByRole("heading", { level: 1 }).evaluate((element) =>
    Number.parseFloat(globalThis.getComputedStyle(element).fontSize),
  );

  await openPage(page, "/", { height: 900, width: 576 });
  const headingAt576 = await page.getByRole("heading", { level: 1 }).evaluate((element) =>
    Number.parseFloat(globalThis.getComputedStyle(element).fontSize),
  );
  expect(Math.abs(headingAt576 - headingAt575)).toBeLessThan(1);

  await openPage(page, "/", gapViewports[0]);
  expect(await page.locator("#features > div > div:last-child").evaluate((element) =>
    globalThis.getComputedStyle(element).gridTemplateColumns.split(" ").length,
  )).toBe(1);

  await openPage(page, "/", canonicalViewports[1]);
  expect(await page.locator("#features > div > div:last-child").evaluate((element) =>
    globalThis.getComputedStyle(element).gridTemplateColumns.split(" ").length,
  )).toBe(2);
});

test("pricing publishes corrected limits and keeps checkout unavailable", async ({ page }) => {
  await openPage(page, "/pricing", canonicalViewports[3]);

  const publicNavigation = page.getByRole("navigation", { exact: true, name: "Public navigation" });
  await expect(publicNavigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("aria-current", "page");

  const upgrade = page.getByRole("button", { name: "Upgrade unavailable" });
  await expect(upgrade).toBeDisabled();
  await expect(page.getByText("Pro checkout opens in the Paddle billing phase.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Blocking Sessions per Club 1 1/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Blocking Sessions per Club" })).toBeVisible();
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

test("contact validates fields, focuses the first error, and reports its message limit", async ({ page }) => {
  await openPage(page, "/contact", canonicalViewports[0]);
  await page.getByRole("button", { name: "Send message" }).click();

  const message = page.getByRole("textbox", { name: "Message — required" });
  await expect(message).toBeFocused();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#contact-message-message")).toHaveText("Enter a message.");
  await message.fill("A concise note");
  await expect(page.getByText("14/500", { exact: true })).toBeVisible();
});

test("contact accepts both new and duplicate submissions through one stable feedback region", async ({ page }) => {
  await openPage(page, "/contact", canonicalViewports[3]);

  await expect(page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  await page.getByRole("textbox", { name: "Message — required" }).fill("A concise note");
  await page.getByRole("textbox", { name: "Your email" }).fill("jane@example.com");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toHaveText("Message received — we'll get back to you soon.");
  await expect(page.getByRole("textbox", { name: "Message — required" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Message sent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Message sent" })).toBeDisabled();

  await page.getByRole("textbox", { name: "Message — required" }).fill("Start another message");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Message — required" }).fill("Duplicate message");
  await page.getByRole("textbox", { name: "Your email" }).fill("jane@example.com");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toHaveText("Message received — we'll get back to you soon.");
});

test("contact prevents edits while a submission is in flight", async ({ page }) => {
  await openPage(page, "/contact", canonicalViewports[0]);

  const message = page.getByRole("textbox", { name: "Message — required" });
  const name = page.getByRole("textbox", { name: "Your name" });
  const email = page.getByRole("textbox", { name: "Your email" });
  await message.fill("Slow Contact response");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(message).toBeDisabled();
  await expect(name).toBeDisabled();
  await expect(email).toBeDisabled();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();

  await expect(page.getByRole("status")).toHaveText("Message received — we'll get back to you soon.");
});

test("contact reuses its submission key after a recoverable service failure", async ({ page }) => {
  await openPage(page, "/contact", canonicalViewports[0]);

  const message = page.getByRole("textbox", { name: "Message — required" });
  await message.fill("Retry this exact message");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Your text is still here");
  await expect(message).toBeEnabled();
  await expect(message).toHaveValue("Retry this exact message");

  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toHaveText("Message received — we'll get back to you soon.");
});

test("contact preserves input across rate-limit, service, and offline recovery", async ({ page }) => {
  await openPage(page, "/contact", canonicalViewports[0]);
  const message = page.getByRole("textbox", { name: "Message — required" });
  await message.fill("Rate limited message");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Try again in 10 minutes");
  await expect(message).toHaveValue("Rate limited message");

  await message.fill("Service unavailable message");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Your text is still here");
  await expect(message).toHaveValue("Service unavailable message");

  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Reconnect, then send again");
  await expect(message).toHaveValue("Service unavailable message");
  await page.context().setOffline(false);
});
