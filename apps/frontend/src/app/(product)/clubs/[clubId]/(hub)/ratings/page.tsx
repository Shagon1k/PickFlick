import { clubRatingsQuerySchema } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { connection } from 'next/server';

import { getClubHub, getClubRatings } from '#api/clubs.server';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';

import HubLoadFailure from '../../_components/HubLoadFailure/HubLoadFailure';
import HubPanel from '../../_components/HubPanel/HubPanel';
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
        return (
            <HubLoadFailure
                error={error}
                title="Club Ratings are temporarily unavailable"
                returnPath={`/clubs/${clubId}/ratings?${new URLSearchParams({ sort: query.sort, page: String(query.page) })}`}
            />
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
