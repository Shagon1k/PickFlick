import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub, getClubSettings } from '#api/clubs.server';

import HubLoadFailure from '../../_components/HubLoadFailure/HubLoadFailure';
import HubPanel from '../../_components/HubPanel/HubPanel';
import ClubMembers from './_components/ClubMembers/ClubMembers';

export const metadata: Metadata = { title: 'Club members — PickFlick' };

export default async function ClubMembersPage({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let projection;
    let hub;
    try {
        [projection, hub] = await Promise.all([getClubSettings(clubId), getClubHub(clubId)]);
    } catch (error) {
        return (
            <HubLoadFailure
                error={error}
                title="Club members are temporarily unavailable"
                returnPath={`/clubs/${clubId}/members`}
            />
        );
    }
    return (
        <HubPanel hub={hub}>
            <ClubMembers projection={projection} />
        </HubPanel>
    );
}
