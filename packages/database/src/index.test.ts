import { describe, expect, it } from "vitest";

import { inspectMigrationPlan, inspectSeedPlan } from "./index.js";

describe("database command plans", () => {
  it("reports the pre-schema migration state explicitly", () => {
    expect(inspectMigrationPlan()).toEqual({ applied: 0, state: "empty" });
  });

  it("reports the pre-schema seed state explicitly", () => {
    expect(inspectSeedPlan()).toEqual({ applied: 0, state: "empty" });
  });
});
