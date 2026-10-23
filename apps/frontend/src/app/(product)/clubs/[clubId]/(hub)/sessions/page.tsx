import { HTTP_STATUS } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import HubPanel from '../../_components/HubPanel/HubPanel';
import HubSessions from '../../_components/HubSessions/HubSessions';
import styles from '../../page.module.scss';

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
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/clubs/${clubId}/sessions`));
        return (
            <HubPanel hub={null}>
                <ProductFrame>
                    <main className={styles.failure}>
                        <h1>
                            {error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)
                                ? 'Club access unavailable'
                                : 'Club Sessions are temporarily unavailable'}
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
            <HubSessions hub={hub} />
        </HubPanel>
    );
}
