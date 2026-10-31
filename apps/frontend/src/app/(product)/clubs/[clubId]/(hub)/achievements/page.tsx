import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubAchievements } from '#api/achievements.server';
import { getClubHub } from '#api/clubs.server';
import Achievements from '#components/achievements/Achievements/Achievements';

import HubLoadFailure from '../../_components/HubLoadFailure/HubLoadFailure';
import HubPanel from '../../_components/HubPanel/HubPanel';

export const metadata: Metadata = { title: 'Club achievements — PickFlick' };

export default async function ClubAchievementsPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    await connection();
    const { clubId } = await params;
    let hub;
    let achievements;
    try {
        [hub, achievements] = await Promise.all([getClubHub(clubId), getClubAchievements(clubId)]);
    } catch (error) {
        return (
            <HubLoadFailure
                error={error}
                title="Club achievements are temporarily unavailable"
                returnPath={`/clubs/${clubId}/achievements`}
            />
        );
    }
    return (
        <HubPanel hub={hub}>
            <Achievements items={achievements.items} />
        </HubPanel>
    );
}
