import { Injectable } from "@nestjs/common";
import type { ClubTierProjection } from "@pickflick/contracts";
import { SYNTHETIC_FIXTURES } from "@pickflick/database";

export type ClubTier = ClubTierProjection["tier"];

const CLUB_TIER_LIMITS: Readonly<Record<ClubTier, ClubTierProjection>> = {
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

export function clubTierLimits(tier: ClubTier): ClubTierProjection {
  return CLUB_TIER_LIMITS[tier];
}

export abstract class ClubTierResolver {
  abstract resolve(clubId: string): Promise<ClubTierProjection>;
}

/** Phase 20 replaces this static seed mapping with subscription-derived tier state. */
@Injectable()
export class StaticClubTierResolver extends ClubTierResolver {
  async resolve(clubId: string): Promise<ClubTierProjection> {
    return clubTierLimits(clubId.toLowerCase() === SYNTHETIC_FIXTURES.club.id ? "PRO" : "FREE");
  }
}
