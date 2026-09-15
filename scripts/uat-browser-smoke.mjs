import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { UAT_BASE_URL } from "./deploy-uat.mjs";

const viewports = [
  { name: "desktop", viewport: { height: 900, width: 1440 } },
  { name: "mobile", viewport: { height: 844, width: 390 } },
];

export function browserSmokeConfiguration(source = process.env) {
  const baseUrl = source.PLAYWRIGHT_BASE_URL?.trim();
  if (baseUrl !== UAT_BASE_URL) {
    throw new Error(`PLAYWRIGHT_BASE_URL must be ${UAT_BASE_URL}.`);
  }
  return {
    artifactDirectory: resolve(source.UAT_SMOKE_ARTIFACT_DIR?.trim() || "test-results/uat-preview"),
    baseUrl,
  };
}

export function isBrandedDocumentTitle(title) {
  return title.startsWith("PickFlick");
}

async function inspectViewport(browser, configuration, profile) {
  const context = await browser.newContext({
    colorScheme: "dark",
    ignoreHTTPSErrors: false,
    reducedMotion: "reduce",
    viewport: profile.viewport,
  });
  const page = await context.newPage();
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push("console error");
    }
  });
  page.on("pageerror", () => failures.push("page error"));

  try {
    const response = await page.goto(configuration.baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response?.ok()) {
      throw new Error(`${profile.name} navigation returned HTTP ${response?.status() ?? "unknown"}.`);
    }
    await page.locator("main h1").first().waitFor({ state: "visible" });
    if (!isBrandedDocumentTitle(await page.title())) {
      throw new Error(`${profile.name} document title did not start with PickFlick.`);
    }
    const hasHorizontalOverflow = await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth,
    );
    if (hasHorizontalOverflow) {
      throw new Error(`${profile.name} viewport has horizontal page overflow.`);
    }
    if (failures.length) {
      throw new Error(`${profile.name} reported ${failures.length} browser error(s).`);
    }
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: resolve(configuration.artifactDirectory, `uat-${profile.name}.png`),
    });
  } finally {
    await context.close();
  }
}

export async function runBrowserSmoke(chromium, source = process.env) {
  const configuration = browserSmokeConfiguration(source);
  await mkdir(configuration.artifactDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const profile of viewports) {
      await inspectViewport(browser, configuration, profile);
    }
  } finally {
    await browser.close();
  }
  return configuration;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { chromium } = await import("@playwright/test");
  const configuration = await runBrowserSmoke(chromium);
  console.log(`Browser smoke passed for ${configuration.baseUrl}.`);
}
