import { HTTP_STATUS, type IClubHub } from '@pickflick/contracts';
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

import HubOverview from '../_components/HubOverview/HubOverview';
import HubPanel from '../_components/HubPanel/HubPanel';
import styles from '../page.module.scss';

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
                    {unavailable ? <RetryButton /> : null}
                    <ButtonLink href="/app" variant="primary">
                        Back to your Clubs
                    </ButtonLink>
                </section>
            </main>
        </ProductFrame>
    );
}

async function HubContent({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let hub: IClubHub;
    try {
        hub = await getClubHub(clubId);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
            redirect(buildLoginPath(`/clubs/${clubId}`));
        }
        return (
            <HubPanel hub={null}>
                <SafeFailure
                    unavailable={
                        !(error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status))
                    }
                />
            </HubPanel>
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
