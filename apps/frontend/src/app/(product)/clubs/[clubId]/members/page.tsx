import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubSettings } from '@/api/clubs.server';
import { loginPath } from '@/api/session.server';
import ProductFrame from '@/components/shells/ProductFrame/ProductFrame';
import { clubNavigation } from '@/components/shells/shell-navigation';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import { ApiError } from '@/lib/api.server';

import ClubMembers from './_components/ClubMembers/ClubMembers';
import styles from './page.module.scss';

export const metadata: Metadata = { title: 'Club members — PickFlick' };

export default async function ClubMembersPage({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let projection;
    try {
        projection = await getClubSettings(clubId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401)
            redirect(loginPath(`/clubs/${clubId}/members`));
        return (
            <ProductFrame>
                <main className={styles.layout}>
                    <h1>
                        {error instanceof ApiError && [400, 404].includes(error.status)
                            ? 'Club access unavailable'
                            : 'Club members are temporarily unavailable'}
                    </h1>
                    <p>Return to your Clubs or retry this page.</p>
                    <ButtonLink href="/app">Back to your Clubs</ButtonLink>
                </main>
            </ProductFrame>
        );
    }
    return (
        <ProductFrame clubItems={clubNavigation(clubId, 'members')}>
            <ClubMembers projection={projection} />
        </ProductFrame>
    );
}
