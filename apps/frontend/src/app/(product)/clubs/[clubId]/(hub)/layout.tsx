import type { IClubHub, IClubSummary } from '@pickflick/contracts';
import type { ReactNode } from 'react';

import { getClubHub, listClubs } from '#api/clubs.server';

import ClubHubFrame from '../_components/ClubHubFrame/ClubHubFrame';

export default async function HubLayout({
    params,
    children,
}: {
    params: Promise<{ clubId: string }>;
    children: ReactNode;
}) {
    const { clubId } = await params;
    let hub: IClubHub | null = null;
    let clubs: IClubSummary[] = [];
    try {
        [hub, clubs] = await Promise.all([getClubHub(clubId), listClubs()]);
    } catch {
        // The requested panel owns sign-in, denial and service-failure recovery.
    }
    return (
        <ClubHubFrame hub={hub} clubs={clubs}>
            {children}
        </ClubHubFrame>
    );
}
