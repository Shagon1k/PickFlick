import { describe, expect, it } from "vitest";

import { browserSmokeConfiguration } from "../uat-browser-smoke.mjs";

describe("UAT browser smoke configuration", () => {
  it("requires a full source revision and resolves the artifact directory", () => {
    const configuration = browserSmokeConfiguration({
      PLAYWRIGHT_BASE_URL: "https://uat.pick-flick.app",
      SOURCE_REVISION: "a".repeat(40),
      UAT_SMOKE_ARTIFACT_DIR: "artifacts/uat",
    });

    expect(configuration.revision).toBe("a".repeat(40));
    expect(configuration.artifactDirectory).toMatch(/artifacts\/uat$/);
  });

  it("rejects an ambiguous source revision", () => {
    expect(() => browserSmokeConfiguration({
      PLAYWRIGHT_BASE_URL: "https://uat.pick-flick.app",
      SOURCE_REVISION: "main",
    })).toThrow(/full 40-character/);
  });

  it("rejects a non-canonical preview URL", () => {
    expect(() => browserSmokeConfiguration({
      PLAYWRIGHT_BASE_URL: "https://preview.example.invalid",
      SOURCE_REVISION: "a".repeat(40),
    })).toThrow(/must be https:\/\/uat\.pick-flick\.app/);
  });
});
