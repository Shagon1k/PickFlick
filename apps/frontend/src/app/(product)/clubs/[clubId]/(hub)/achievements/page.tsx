import { HTTP_STATUS } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubAchievements } from '#api/achievements.server';
import { getClubHub } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import Achievements from '#components/achievements/Achievements/Achievements';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import HubPanel from '../../_components/HubPanel/HubPanel';
import styles from '../../page.module.scss';

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
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/clubs/${clubId}/achievements`));
        return (
            <HubPanel hub={null}>
                <ProductFrame>
                    <main className={styles.failure}>
                        <h1>
                            {error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)
                                ? 'Club access unavailable'
                                : 'Club achievements are temporarily unavailable'}
                        </h1>
                        <p>Return to your Clubs or retry this page.</p>
                        {!(
                            error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)
                        ) ? (
                            <RetryButton />
                        ) : null}
                        <ButtonLink href="/app">Back to your Clubs</ButtonLink>
                    </main>
                </ProductFrame>
            </HubPanel>
        );
    }
    return (
        <HubPanel hub={hub}>
            <Achievements items={achievements.items} />
        </HubPanel>
    );
}
