import { HTTP_STATUS, isBlockingSessionPhase } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import BackLink from '#components/navigation/BackLink/BackLink';
import SessionForm from '#components/sessions/SessionForm/SessionForm';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import ButtonLink from '#components/ui/Button/ButtonLink';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { ApiError } from '#lib/api.server';

import styles from './page.module.scss';

export const metadata: Metadata = { title: 'Create a Session — PickFlick' };
export default async function CreateSessionPage({
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
            redirect(buildLoginPath(`/clubs/${clubId}/sessions/new`));
        return (
            <main className={styles.main}>
                <section className={styles.card}>
                    <h1>Session creation unavailable</h1>
                    <p role="alert">
                        We could not open this Club. Return to your Clubs and try again.
                    </p>
                    <ButtonLink href="/app">Back to your Clubs</ButtonLink>
                </section>
            </main>
        );
    }
    const isBlocked = isBlockingSessionPhase(hub.activeSession?.phase);
    let restriction: 'blocking' | 'permission' | undefined;
    if (!hub.permissions.manageSessions) restriction = 'permission';
    else if (isBlocked) restriction = 'blocking';
    return (
        <main className={styles.main}>
            <BackLink className={styles.back} fallbackHref={`/clubs/${clubId}`} />
            <section aria-labelledby="create-session-title" className={styles.scene}>
                <BrandImage
                    alt=""
                    asset="sessionManagement"
                    className={styles.mascot}
                    loading="eager"
                />
                <div className={styles.card}>
                    <h1 id="create-session-title">Schedule a Session</h1>
                    <p className={styles.lead}>Pick a date, name the place, set the mood.</p>
                    <SessionForm clubId={clubId} creationRestriction={restriction} />
                </div>
                <SprocketDivider />
                <p className={styles.ornament}>{hub.club.name} · Lights, camera, action</p>
            </section>
        </main>
    );
}
