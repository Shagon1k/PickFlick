import { createHash } from 'node:crypto';

import { type IClubSummary, selectionScaleMinSchema, type TClubRole } from '@pickflick/contracts';

import { getClubEntitlements } from './access/club-tiers.js';

const AVATAR_VERSION_LENGTH = 16;

interface IClubRow {
    id: string;
    name: string;
    createdAt: Date;
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
        createdAt: club.createdAt.toISOString(),
        ...(club.description ? { description: club.description } : {}),
        hasAvatar: Boolean(club.avatarObjectKey),
        // Changes with every upload, so browsers refetch the private avatar URL.
        ...(club.avatarObjectKey
            ? {
                  avatarVersion: createHash('sha256')
                      .update(club.avatarObjectKey)
                      .digest('hex')
                      .slice(0, AVATAR_VERSION_LENGTH),
              }
            : {}),
        lifecycle: club.lifecycle,
        membershipRole: role,
        selectionScaleMin: selectionScaleMinSchema.parse(club.selectionScaleMin),
        selectionScaleMax: club.selectionScaleMax,
        tier: getClubEntitlements(club.id).tier,
    };
}
