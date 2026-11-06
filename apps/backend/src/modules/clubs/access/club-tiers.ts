import {
    CLUB_TIER_ENTITLEMENTS,
    type IClubEntitlements,
    type TClubTier,
} from '@pickflick/contracts';
import { SYNTHETIC_FIXTURES } from '@pickflick/database';

export function getTierEntitlements(tier: TClubTier): IClubEntitlements {
    return CLUB_TIER_ENTITLEMENTS[tier];
}

/** Every Club is Free until billing (Phase 20); the seeded demo Club is Pro so both paths show. */
export function getClubEntitlements(clubId: string): IClubEntitlements {
    return getTierEntitlements(clubId === SYNTHETIC_FIXTURES.club.id ? 'PRO' : 'FREE');
}
