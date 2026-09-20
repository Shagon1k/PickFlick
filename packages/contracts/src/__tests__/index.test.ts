import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ClubLifecycleRequest,
  ClubOperationRequest,
  ConfirmedClubOperationRequest,
} from "../index.js";
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
      "viewAudit",
    ]);
  });

  it("separates operation-only and confirmed Club lifecycle requests", () => {
    expectTypeOf<ClubOperationRequest>().not.toHaveProperty("confirmation");
    expectTypeOf<ConfirmedClubOperationRequest>().toHaveProperty("confirmation").toEqualTypeOf<string>();
    expectTypeOf<Extract<ClubLifecycleRequest, { action: "reactivate" }>>()
      .not.toHaveProperty("confirmation");
    expectTypeOf<Extract<ClubLifecycleRequest, { confirmation: string }>>()
      .toHaveProperty("confirmation")
      .toEqualTypeOf<string>();
    expectTypeOf<Extract<ClubLifecycleRequest, { confirmation: string }>>()
      .toHaveProperty("action")
      .toEqualTypeOf<"archive" | "delete" | "leave">();
  });
});
