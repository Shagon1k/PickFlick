import { HTTP_STATUS } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub, getClubSettings } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import HubPanel from '../../_components/HubPanel/HubPanel';
import ClubMembers from './_components/ClubMembers/ClubMembers';
import styles from './page.module.scss';

export const metadata: Metadata = { title: 'Club members — PickFlick' };

export default async function ClubMembersPage({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let projection;
    let hub;
    try {
        [projection, hub] = await Promise.all([getClubSettings(clubId), getClubHub(clubId)]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/clubs/${clubId}/members`));
        return (
            <HubPanel hub={null}>
                <ProductFrame>
                    <main className={styles.layout}>
                        <h1>
                            {error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)
                                ? 'Club access unavailable'
                                : 'Club members are temporarily unavailable'}
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
            <ClubMembers projection={projection} />
        </HubPanel>
    );
}
