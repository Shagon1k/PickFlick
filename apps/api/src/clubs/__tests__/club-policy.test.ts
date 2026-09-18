import { CLUB_POLICY_ACTIONS, type ClubPolicyAction } from "@pickflick/contracts";
import { SYNTHETIC_FIXTURES } from "@pickflick/database";
import { describe, expect, it } from "vitest";

import { projectClubPermissions, type ClubPolicySubject } from "../club-policy.js";
import { ClubRepository } from "../club.repository.js";
import { StaticClubTierResolver } from "../club-tiers.js";
import { ClubPolicyService } from "../clubs.service.js";

class PolicyRepository extends ClubRepository {
  async readPolicySubject(): Promise<ClubPolicySubject> {
    return { appRole: "USER", clubRole: "ADMIN", lifecycle: "ACTIVE", userStatus: "ACTIVE" };
  }

  async changeMembershipRole(): Promise<never> {
    throw new Error("Not used by this test.");
  }

  async transferAdministration(): Promise<never> {
    throw new Error("Not used by this test.");
  }
}

function allowedActions(subject: ClubPolicySubject): ClubPolicyAction[] {
  const permissions = projectClubPermissions(subject);
  return CLUB_POLICY_ACTIONS.filter((action) => permissions[action]);
}

describe("Club policy", () => {
  it.each([
    {
      name: "Club Admin",
      subject: { appRole: "USER", clubRole: "ADMIN", lifecycle: "ACTIVE", userStatus: "ACTIVE" },
      allowed: [
        "viewClub",
        "participate",
        "manageSessions",
        "manageMembers",
        "manageRoles",
        "manageSettings",
        "manageLifecycle",
        "viewAudit",
      ],
    },
    {
      name: "Moderator",
      subject: { appRole: "USER", clubRole: "MODERATOR", lifecycle: "ACTIVE", userStatus: "ACTIVE" },
      allowed: ["viewClub", "participate", "leaveClub", "manageSessions"],
    },
    {
      name: "Member",
      subject: { appRole: "USER", clubRole: "MEMBER", lifecycle: "ACTIVE", userStatus: "ACTIVE" },
      allowed: ["viewClub", "participate", "leaveClub"],
    },
    {
      name: "App Admin without Membership",
      subject: { appRole: "APP_ADMIN", clubRole: null, lifecycle: null, userStatus: "ACTIVE" },
      allowed: [],
    },
    {
      name: "App Admin with Member role",
      subject: { appRole: "APP_ADMIN", clubRole: "MEMBER", lifecycle: "ACTIVE", userStatus: "ACTIVE" },
      allowed: ["viewClub", "participate", "leaveClub"],
    },
    {
      name: "suspended Club Admin",
      subject: { appRole: "USER", clubRole: "ADMIN", lifecycle: "ACTIVE", userStatus: "SUSPENDED" },
      allowed: [],
    },
    {
      name: "non-member",
      subject: { appRole: "USER", clubRole: null, lifecycle: null, userStatus: "ACTIVE" },
      allowed: [],
    },
  ] satisfies ReadonlyArray<{
    name: string;
    subject: ClubPolicySubject;
    allowed: ClubPolicyAction[];
  }>)("applies the complete active-Club matrix to $name", ({ subject, allowed }) => {
    expect(allowedActions(subject)).toEqual(allowed);
  });

  it.each([
    ["ADMIN", ["viewClub", "manageLifecycle", "viewAudit"]],
    ["MODERATOR", ["viewClub", "leaveClub"]],
    ["MEMBER", ["viewClub", "leaveClub"]],
  ] as const)("keeps archived Clubs read-only for %s", (clubRole, allowed) => {
    expect(
      allowedActions({ appRole: "USER", clubRole, lifecycle: "ARCHIVED", userStatus: "ACTIVE" }),
    ).toEqual(allowed);
  });

  it("projects both static Club tiers through the policy service", async () => {
    const policy = new ClubPolicyService(new PolicyRepository(), new StaticClubTierResolver());
    const principal = {
      appRole: "USER" as const,
      sessionId: "30000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000001",
    };
    const [freePolicy, proPolicy] = await Promise.all([
      policy.project(principal, "10000000-0000-4000-8000-000000000002"),
      policy.project(principal, SYNTHETIC_FIXTURES.club.id.toUpperCase()),
    ]);

    expect(freePolicy.entitlements).toEqual({
      tier: "FREE",
      adminClubLimit: 1,
      memberLimit: 8,
      blockingSessionLimit: 1,
      inactivityGraceDays: 90,
      voteResultVisibility: "ADMIN_HIDDEN",
      analyticsTier: "BASIC",
    });
    expect(proPolicy.entitlements).toEqual({
      tier: "PRO",
      adminClubLimit: 5,
      memberLimit: 16,
      blockingSessionLimit: 1,
      inactivityGraceDays: 180,
      voteResultVisibility: "ADMIN_CONFIGURABLE",
      analyticsTier: "EXTENDED",
    });
  });
});
