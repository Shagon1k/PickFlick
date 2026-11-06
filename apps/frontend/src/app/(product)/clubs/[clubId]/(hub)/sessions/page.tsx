import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub } from '#api/clubs.server';

import HubLoadFailure from '../../_components/HubLoadFailure/HubLoadFailure';
import HubPanel from '../../_components/HubPanel/HubPanel';
import HubSessions from '../../_components/HubSessions/HubSessions';

export const metadata: Metadata = { title: 'Club Sessions — PickFlick' };

export default async function ClubSessionsPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    await connection();
    const { clubId } = await params;
    let hub;
    try {
        hub = await getClubHub(clubId);
    } catch (error) {
        return (
            <HubLoadFailure
                error={error}
                title="Club Sessions are temporarily unavailable"
                returnPath={`/clubs/${clubId}/sessions`}
            />
        );
    }
    return (
        <HubPanel hub={hub}>
            <HubSessions hub={hub} />
        </HubPanel>
    );
}
