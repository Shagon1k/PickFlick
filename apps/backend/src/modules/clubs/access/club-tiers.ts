import type { IClubEntitlements, TClubTier } from '@pickflick/contracts';
import { SYNTHETIC_FIXTURES } from '@pickflick/database';

const TIERS: Record<TClubTier, IClubEntitlements> = {
    FREE: { tier: 'FREE', adminClubLimit: 1, memberLimit: 8, voteResultVisibility: 'ADMIN_HIDDEN' },
    PRO: {
        tier: 'PRO',
        adminClubLimit: 5,
        memberLimit: 16,
        voteResultVisibility: 'ADMIN_CONFIGURABLE',
    },
};

export function getTierEntitlements(tier: TClubTier): IClubEntitlements {
    return TIERS[tier];
}

/** Every Club is Free until billing (Phase 20); the seeded demo Club is Pro so both paths show. */
export function getClubEntitlements(clubId: string): IClubEntitlements {
    return getTierEntitlements(clubId === SYNTHETIC_FIXTURES.club.id ? 'PRO' : 'FREE');
}
