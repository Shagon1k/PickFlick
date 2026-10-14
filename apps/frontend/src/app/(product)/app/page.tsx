import { HTTP_STATUS, type IClubSummary } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listClubs } from '#api/clubs.server';
import { buildLoginPath } from '#api/session.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import BrandImage from '#components/ui/BrandImage/BrandImage';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';

import styles from '../onboarding.module.scss';

export const metadata: Metadata = {
    title: 'Your Clubs — PickFlick',
    description: 'Open or create your private PickFlick Club.',
};

function NoClubs() {
    return (
        <ProductFrame>
            <main className={styles.noClubsMain}>
                <section aria-labelledby="no-clubs-title" className={styles.noClubsStage}>
                    <div aria-hidden="true" className={styles.illustration}>
                        <BrandImage alt="" asset="sessionManagement" loading="eager" />
                    </div>
                    <div className={styles.body}>
                        <p className={styles.kicker}>Your screening room awaits</p>
                        <h1 id="no-clubs-title">You haven&apos;t joined any Clubs yet</h1>
                        <p className={styles.copy}>
                            Create a film Club for your crew. PickFlick will keep nominations, watch
                            nights, and ratings in one place.
                        </p>
                        <div className={styles.actions}>
                            <ButtonLink href="/clubs/new" variant="primary">
                                Create a Club
                            </ButtonLink>
                        </div>
                        <p className={styles.note}>
                            Have an invitation? Open its private link to join that Club.
                        </p>
                    </div>
                </section>
            </main>
        </ProductFrame>
    );
}

function ClubsUnavailable() {
    return (
        <ProductFrame>
            <main className={styles.readyMain}>
                <section aria-labelledby="clubs-unavailable-title" className={styles.readyCard}>
                    <p className={styles.kicker}>Projection interrupted</p>
                    <h1 id="clubs-unavailable-title">Your Clubs are temporarily unavailable</h1>
                    <p>Nothing was changed. Try loading the screening room again.</p>
                    <div className={styles.actions}>
                        <ButtonLink href="/app" variant="primary">
                            Try again
                        </ButtonLink>
                    </div>
                </section>
            </main>
        </ProductFrame>
    );
}

export default async function AppPage() {
    await connection();
    let clubs: IClubSummary[];
    try {
        clubs = await listClubs();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
            redirect(buildLoginPath('/app'));
        }
        return <ClubsUnavailable />;
    }
    const lastClubId = (await cookies()).get('pickflick.last_club')?.value;
    const club = clubs.find(({ id }) => id === lastClubId) ?? clubs[0];
    if (!club) {
        return <NoClubs />;
    }
    redirect(`/clubs/${club.id}`);
}
