import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { ActionLink, BrandImage, SprocketDivider } from '@pickflick/ui';

import { getSessionState, loginPath } from '@/api/session.server';
import styles from '@/app/(product)/onboarding.module.scss';
import { CreateClubForm } from '@/app/(product)/clubs/new/_components/CreateClubForm/CreateClubForm';
import { BackLink } from '@/components/navigation/BackLink/BackLink';

export const metadata: Metadata = {
    title: 'Create a Club — PickFlick',
    description: 'Name your PickFlick Club and choose its Selection score range.',
};

export default async function CreateClubPage() {
    await connection();
    const session = await getSessionState();
    if (session === 'anonymous') {
        redirect(loginPath('/clubs/new'));
    }

    return (
        <main className={styles.setupMain}>
            <BackLink className={styles.backLink} fallbackHref="/app" />
            <section aria-labelledby="create-club-title" className={styles.createScene}>
                <BrandImage
                    alt=""
                    asset="settingsSubscription"
                    className={styles.mascot}
                    loading="eager"
                />
                <div className={styles.createCard}>
                    <h1 id="create-club-title">Open a Screening Room</h1>
                    {session === 'unavailable' ? (
                        <>
                            <p className={styles.lead} role="alert">
                                We could not confirm your session right now. Nothing was created;
                                try again in a moment.
                            </p>
                            <div className={styles.actions}>
                                <ActionLink href="/clubs/new" variant="primary">
                                    Try again
                                </ActionLink>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className={styles.lead}>Every great film Club starts with a name.</p>
                            <CreateClubForm />
                        </>
                    )}
                </div>
                <SprocketDivider />
                <p aria-hidden="true" className={styles.sceneOrnament}>
                    Scene 02 · Opening Night
                </p>
            </section>
        </main>
    );
}
