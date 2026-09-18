import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, CLUB_POLICY_ACTIONS, DEPENDENCY_NAMES, SERVICE_NAMES } from "../index.js";

describe("service contracts", () => {
  it("names each independent runtime", () => {
    expect(Object.values(SERVICE_NAMES)).toEqual(["api", "web", "worker"]);
  });

  it("keeps health dependency names stable", () => {
    expect(DEPENDENCY_NAMES).toEqual(["database", "redis", "objectStorage"]);
  });

  it("keeps safe API error codes stable", () => {
    expect(API_ERROR_CODES).toContain("VALIDATION_FAILED");
    expect(API_ERROR_CODES).toContain("INTERNAL_ERROR");
  });

  it("keeps the complete Club policy action vocabulary stable", () => {
    expect(CLUB_POLICY_ACTIONS).toEqual([
      "viewClub",
      "participate",
      "leaveClub",
      "manageSessions",
      "manageMembers",
      "manageRoles",
      "manageSettings",
      "manageLifecycle",
      "transferAdministration",
      "viewAudit",
    ]);
  });
});
