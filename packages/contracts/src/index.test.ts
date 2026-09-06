import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, DEPENDENCY_NAMES, SERVICE_NAMES } from "./index.js";

describe("service contracts", () => {
  it("names each independent runtime", () => {
    expect(Object.values(SERVICE_NAMES)).toEqual(["api", "web", "worker"]);
  });

  it("keeps health dependency names stable", () => {
    expect(DEPENDENCY_NAMES).toEqual(["database", "redis", "objectStorage", "smtp"]);
  });

  it("keeps safe API error codes stable", () => {
    expect(API_ERROR_CODES).toContain("VALIDATION_FAILED");
    expect(API_ERROR_CODES).toContain("INTERNAL_ERROR");
  });
});
