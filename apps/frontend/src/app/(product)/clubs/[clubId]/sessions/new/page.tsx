import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getClubHub } from '@/api/clubs.server';
import { loginPath } from '@/api/session.server';
import SessionForm from '@/components/sessions/SessionForm/SessionForm';
import BrandImage from '@/components/ui/BrandImage/BrandImage';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import SprocketDivider from '@/components/ui/SprocketDivider/SprocketDivider';
import { ApiError } from '@/lib/api.server';

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
        if (error instanceof ApiError && error.status === 401)
            redirect(loginPath(`/clubs/${clubId}/sessions/new`));
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
    const blocked =
        hub.activeSession &&
        ['NOMINATION', 'SELECTION', 'WATCHING'].includes(hub.activeSession.phase);
    let restriction: 'blocking' | 'permission' | undefined;
    if (!hub.permissions.manageSessions) restriction = 'permission';
    else if (blocked) restriction = 'blocking';
    return (
        <main className={styles.main}>
            <Link className={styles.back} href={`/clubs/${clubId}`}>
                ← Back
            </Link>
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
                <p className={styles.ornament}>{hub.club.name} · Lights, Camera, Action</p>
            </section>
        </main>
    );
}
