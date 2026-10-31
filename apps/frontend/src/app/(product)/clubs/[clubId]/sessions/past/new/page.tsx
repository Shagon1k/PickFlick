import { HTTP_STATUS } from '@pickflick/contracts';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { buildLoginPath } from '#api/auth-session.server';
import { getClubHub } from '#api/clubs.server';
import { getPastSessionMembers } from '#api/sessions.server';
import BackLink from '#components/navigation/BackLink/BackLink';
import SystemState from '#components/shells/SystemState/SystemState';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import ButtonLink from '#components/ui/Button/ButtonLink';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { ApiError } from '#lib/api.server';

import styles from '../../session-form-page.module.scss';
import PastSessionForm from './_components/PastSessionForm/PastSessionForm';

export const metadata = { title: 'Log a Past Session — PickFlick' };

export default async function PastSessionPage({ params }: { params: Promise<{ clubId: string }> }) {
    await connection();
    const { clubId } = await params;
    let hub;
    let members;
    try {
        hub = await getClubHub(clubId);
        members = hub.permissions.manageSessions ? await getPastSessionMembers(clubId) : null;
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/clubs/${clubId}/sessions/past/new`));
        return (
            <SystemState
                description="We could not open this form."
                isSignedIn
                retryHref={`/clubs/${clubId}/sessions/past/new`}
                title="Past Session unavailable"
                variant="application-error"
            />
        );
    }
    return (
        <main className={styles.main}>
            <BackLink className={styles.back} fallbackHref={`/clubs/${clubId}`} />
            <section className={styles.scene} aria-labelledby="past-session-title">
                <BrandImage
                    alt=""
                    asset="sessionManagement"
                    className={styles.mascot}
                    loading="eager"
                />
                <div className={styles.card}>
                    <h1 id="past-session-title">Log a Past Session</h1>
                    <p className={styles.lead}>
                        Add a screening that already happened to your Club’s history.
                    </p>
                    {members ? (
                        <PastSessionForm
                            clubId={clubId}
                            members={members}
                            scaleMin={hub.club.selectionScaleMin}
                            scaleMax={hub.club.selectionScaleMax}
                        />
                    ) : (
                        <>
                            <p role="status">
                                You cannot log a past Session in this Club right now.
                            </p>
                            <ButtonLink href={`/clubs/${clubId}`}>Back to Club Hub</ButtonLink>
                        </>
                    )}
                </div>
                <SprocketDivider />
                <p className={styles.ornament}>{hub.club.name} · Shared history</p>
            </section>
        </main>
    );
}
