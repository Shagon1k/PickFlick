import { HTTP_STATUS, type IClubSettings } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub, getClubSettings, listClubs } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';

import ClubHubFrame from '../_components/ClubHubFrame/ClubHubFrame';
import ClubSettings from './_components/ClubSettings/ClubSettings';
import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Club settings — PickFlick',
    description: 'Manage one private PickFlick Club.',
};

function SafeFailure({ forbidden = false }: { forbidden?: boolean }) {
    return (
        <ProductFrame>
            <main className={styles.layout}>
                <section className={styles.card}>
                    <p className={styles.kicker}>
                        {forbidden ? 'Private Club' : 'Projection interrupted'}
                    </p>
                    <h1>
                        {forbidden
                            ? 'Club access unavailable'
                            : 'Club settings are temporarily unavailable'}
                    </h1>
                    <p className={styles.explanation}>
                        {forbidden
                            ? 'This page requires an active Membership. No Club details were disclosed.'
                            : 'Nothing was changed. Return to your Clubs or retry this page.'}
                    </p>
                    <div className={styles.formFooter}>
                        {!forbidden ? <RetryButton /> : null}
                        <ButtonLink href="/app" variant="primary">
                            Back to your Clubs
                        </ButtonLink>
                    </div>
                </section>
            </main>
        </ProductFrame>
    );
}

export default async function ClubSettingsPage({
    params,
}: {
    params: Promise<{ clubId: string }>;
}) {
    await connection();
    const { clubId } = await params;
    let settings: IClubSettings;
    let hub;
    let clubs;
    try {
        [settings, hub, clubs] = await Promise.all([
            getClubSettings(clubId),
            getClubHub(clubId),
            listClubs(),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
            redirect(buildLoginPath(`/clubs/${clubId}/settings`));
        }
        // A Club the visitor cannot see answers 404, so nothing about it is disclosed.
        return (
            <SafeFailure
                forbidden={error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND}
            />
        );
    }
    return (
        <ClubHubFrame clubs={clubs} hub={hub} current="manage">
            <ClubSettings projection={settings} />
        </ClubHubFrame>
    );
}
