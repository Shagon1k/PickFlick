import type { IClubHub } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub } from '#api/clubs.server';

import HubLoadFailure from '../_components/HubLoadFailure/HubLoadFailure';
import HubOverview from '../_components/HubOverview/HubOverview';
import HubPanel from '../_components/HubPanel/HubPanel';

export const metadata: Metadata = {
    title: 'Club Hub — PickFlick',
    description: 'Your private Club overview.',
};

async function HubContent({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let hub: IClubHub;
    try {
        hub = await getClubHub(clubId);
    } catch (error) {
        return (
            <HubLoadFailure
                error={error}
                title="The Club Hub is temporarily unavailable"
                returnPath={`/clubs/${clubId}`}
            />
        );
    }
    return (
        <HubPanel hub={hub}>
            <HubOverview hub={hub} />
        </HubPanel>
    );
}

export default async function ClubHubPage({ params }: { params: Promise<{ clubId: string }> }) {
    return <HubContent params={params} />;
}
