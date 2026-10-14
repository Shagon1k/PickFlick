import { createHash } from 'node:crypto';

import type { IClubSummary, TClubRole } from '@pickflick/contracts';

import { getClubEntitlements } from './access/club-tiers.js';

interface IClubRow {
    id: string;
    name: string;
    description: string | null;
    avatarObjectKey: string | null;
    lifecycle: IClubSummary['lifecycle'];
    selectionScaleMin: number;
    selectionScaleMax: number;
}

export function toClubSummary(club: IClubRow, role: TClubRole): IClubSummary {
    return {
        id: club.id,
        name: club.name,
        ...(club.description ? { description: club.description } : {}),
        hasAvatar: Boolean(club.avatarObjectKey),
        // Changes with every upload, so browsers refetch the private avatar URL.
        ...(club.avatarObjectKey
            ? {
                  avatarVersion: createHash('sha256')
                      .update(club.avatarObjectKey)
                      .digest('hex')
                      .slice(0, 16),
              }
            : {}),
        lifecycle: club.lifecycle,
        membershipRole: role,
        selectionScaleMin: club.selectionScaleMin === 1 ? 1 : 0,
        selectionScaleMax: club.selectionScaleMax,
        tier: getClubEntitlements(club.id).tier,
    };
}
