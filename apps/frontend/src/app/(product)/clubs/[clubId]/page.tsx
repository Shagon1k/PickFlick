import { HTTP_STATUS, type IClubHub, type IClubSummary } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { getClubHub, listClubs } from '@/api/clubs.server';
import { buildLoginPath } from '@/api/session.server';
import ProductFrame from '@/components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '@/components/shells/shell-navigation';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import LoadingState from '@/components/ui/LoadingState/LoadingState';
import { ApiError } from '@/lib/api.server';
import { NOT_FOUND_STATUSES } from '@/lib/http-status';

import HubOverview from './_components/HubOverview/HubOverview';
import styles from './page.module.scss';

const HUB_LOADING_LINES = 6;

export const metadata: Metadata = {
    title: 'Club Hub — PickFlick',
    description: 'Your private Club overview.',
};

function SafeFailure({ unavailable }: { unavailable: boolean }) {
    return (
        <ProductFrame>
            <main className={styles.failure}>
                <section aria-labelledby="hub-failure-title" className={styles.failureCard}>
                    <p className={styles.eyebrow}>
                        {unavailable ? 'Projection interrupted' : 'Private Club'}
                    </p>
                    <h1 id="hub-failure-title">
                        {unavailable
                            ? 'The Club Hub is temporarily unavailable'
                            : 'Club access unavailable'}
                    </h1>
                    <p>
                        {unavailable
                            ? 'Try again in a moment. No Club information was changed.'
                            : 'This Club requires an active Membership.'}
                    </p>
                    <ButtonLink href="/app" variant="primary">
                        Back to your Clubs
                    </ButtonLink>
                </section>
            </main>
        </ProductFrame>
    );
}

function HubLoading() {
    return (
        <ProductFrame>
            <main className={styles.loading}>
                <LoadingState label="Loading Club Hub" lines={HUB_LOADING_LINES} />
            </main>
        </ProductFrame>
    );
}

async function HubContent({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let hub: IClubHub;
    let clubs: IClubSummary[];
    try {
        [hub, clubs] = await Promise.all([getClubHub(clubId), listClubs()]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
            redirect(buildLoginPath(`/clubs/${clubId}`));
        }
        return (
            <SafeFailure
                unavailable={
                    !(error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status))
                }
            />
        );
    }
    return (
        <ProductFrame clubItems={buildClubNavigation(clubId, 'overview')}>
            <HubOverview clubs={clubs} hub={hub} />
        </ProductFrame>
    );
}

export default function ClubHubPage({ params }: { params: Promise<{ clubId: string }> }) {
    return (
        <Suspense fallback={<HubLoading />}>
            <HubContent params={params} />
        </Suspense>
    );
}
