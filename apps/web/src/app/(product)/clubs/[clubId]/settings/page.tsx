import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import type { IClubSettings } from '@pickflick/contracts';
import { ActionLink } from '@pickflick/ui';

import { getClubSettings } from '@/api/clubs.server';
import { loginPath } from '@/api/session.server';
import { ApiError } from '@/lib/api.server';
import { ClubSettings } from '@/app/(product)/clubs/[clubId]/settings/_components/ClubSettings/ClubSettings';
import styles from '@/app/(product)/clubs/[clubId]/settings/settings.module.scss';
import { clubNavigation } from '@/components/shells/shell-navigation';
import { ProductFrame } from '@/components/shells/shells';

export const metadata: Metadata = {
    title: 'Club settings — PickFlick',
    description: 'Manage one private PickFlick Club.',
};

function SafeFailure({ forbidden = false }: Readonly<{ forbidden?: boolean }>) {
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
                        <ActionLink href="/app" variant="primary">
                            Back to your Clubs
                        </ActionLink>
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
    try {
        settings = await getClubSettings(clubId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            redirect(loginPath(`/clubs/${clubId}/settings`));
        }
        // A Club the visitor cannot see answers 404, so nothing about it is disclosed.
        return <SafeFailure forbidden={error instanceof ApiError && error.status === 404} />;
    }
    return (
        <ProductFrame clubItems={clubNavigation(clubId, 'manage')}>
            <ClubSettings projection={settings} />
        </ProductFrame>
    );
}
