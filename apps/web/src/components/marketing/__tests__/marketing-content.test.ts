import { describe, expect, it } from "vitest";

import {
  comparisonRows,
  freePlanFeatures,
  pricingFaqs,
  proPlanFeatures,
} from "../marketing-content";

describe("public plan contract", () => {
  it("keeps canonical Free and Pro limits aligned", () => {
    expect(comparisonRows).toContainEqual({
      feature: "Blocking Sessions per Club",
      free: "1",
      pro: "1",
    });
    expect(comparisonRows).toContainEqual({
      feature: "Open Rating Sessions per Club",
      free: "Unlimited",
      pro: "Unlimited",
    });
    expect(freePlanFeatures.map(({ label }) => label)).toContain("1 blocking Session per Club");
    expect(proPlanFeatures.map(({ label }) => label)).toContain("1 blocking Session per Club");
  });

  it("marks Free restrictions as limits rather than included features", () => {
    expect(freePlanFeatures.filter(({ tone }) => tone === "limited").map(({ label }) => label)).toEqual([
      "Vote results hidden from ordinary members",
      "90-day inactivity grace",
    ]);
  });

  it("publishes only the monthly Pro offer", () => {
    const publicPricingCopy = JSON.stringify({ comparisonRows, pricingFaqs, proPlanFeatures });

    expect(comparisonRows).toContainEqual({ feature: "Price", free: "€0", pro: "€5 / month" });
    expect(publicPricingCopy).not.toMatch(/annual|yearly|per year/i);
  });

  it("does not promise unavailable AI or checkout behavior", () => {
    const publicPricingCopy = JSON.stringify({ comparisonRows, pricingFaqs, proPlanFeatures });

    expect(publicPricingCopy).not.toMatch(/AI analytics|AI movie recommendations/i);
    expect(pricingFaqs.at(-1)?.answer).toMatch(/checkout will open in the Paddle billing phase/i);
  });
});
