import { Injectable } from "@nestjs/common";
import type { ClubEntitlementProjection } from "@pickflick/contracts";

export type FixtureEntitlementTier = ClubEntitlementProjection["tier"];

const FIXTURE_ENTITLEMENTS: Readonly<Record<FixtureEntitlementTier, ClubEntitlementProjection>> = {
  FREE: {
    tier: "FREE",
    adminClubLimit: 1,
    memberLimit: 8,
    blockingSessionLimit: 1,
    inactivityGraceDays: 90,
    voteResultVisibility: "ADMIN_HIDDEN",
    analyticsTier: "BASIC",
  },
  PRO: {
    tier: "PRO",
    adminClubLimit: 5,
    memberLimit: 16,
    blockingSessionLimit: 1,
    inactivityGraceDays: 180,
    voteResultVisibility: "ADMIN_CONFIGURABLE",
    analyticsTier: "EXTENDED",
  },
};

export function fixtureClubEntitlements(tier: FixtureEntitlementTier): ClubEntitlementProjection {
  return FIXTURE_ENTITLEMENTS[tier];
}

export abstract class ClubEntitlementResolver {
  abstract resolve(clubId: string): Promise<ClubEntitlementProjection>;
}

/** Phase 20 replaces this resolver with subscription-derived entitlement state. */
@Injectable()
export class FixtureClubEntitlementResolver extends ClubEntitlementResolver {
  async resolve(): Promise<ClubEntitlementProjection> {
    return fixtureClubEntitlements("FREE");
  }
}
