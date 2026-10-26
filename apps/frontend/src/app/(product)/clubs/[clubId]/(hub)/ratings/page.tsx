import { clubRatingsQuerySchema, HTTP_STATUS } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub, getClubRatings } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import HubPanel from '../../_components/HubPanel/HubPanel';
import styles from '../../page.module.scss';
import ClubRatings from './_components/ClubRatings/ClubRatings';

export const metadata: Metadata = { title: 'Club Ratings — PickFlick' };

export default async function ClubRatingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ clubId: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await connection();
    const { clubId } = await params;
    const parsed = clubRatingsQuerySchema.safeParse(await searchParams);
    const query = parsed.data ?? clubRatingsQuerySchema.parse({});
    let hub;
    let ratings;
    try {
        [hub, ratings] = await Promise.all([
            getClubHub(clubId),
            parsed.success ? getClubRatings(clubId, query) : null,
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(
                buildLoginPath(
                    `/clubs/${clubId}/ratings?${new URLSearchParams({ sort: query.sort, page: String(query.page) })}`,
                ),
            );
        return (
            <HubPanel hub={null}>
                <ProductFrame>
                    <main className={styles.failure}>
                        <h1>
                            {error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)
                                ? 'Club access unavailable'
                                : 'Club Ratings are temporarily unavailable'}
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
            {ratings ? (
                <ClubRatings clubId={clubId} ratings={ratings} query={query} />
            ) : (
                <section aria-label="Invalid ratings filters">
                    <Alert tone="warning">
                        These ratings filters are invalid. Clear them and try again.
                    </Alert>
                    <ButtonLink href={`/clubs/${clubId}/ratings`}>Clear filters</ButtonLink>
                </section>
            )}
        </HubPanel>
    );
}
