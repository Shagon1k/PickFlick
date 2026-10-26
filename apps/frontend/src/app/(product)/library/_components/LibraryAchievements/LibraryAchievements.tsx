import { HTTP_STATUS } from '@pickflick/contracts';
import { redirect } from 'next/navigation';

import { getPersonalAchievements } from '#api/achievements.server';
import { getLibraryStatistics } from '#api/library.server';
import { buildLoginPath } from '#api/session.server';
import Achievements from '#components/library/Achievements/Achievements';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';

import LibraryStatistics from '../LibraryStatistics/LibraryStatistics';

async function loadAchievements() {
    try {
        return await getPersonalAchievements();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath('/library?tab=achievements'));
        if (
            !(
                error instanceof ApiError ||
                error instanceof TypeError ||
                (error instanceof DOMException && error.name === 'TimeoutError')
            )
        )
            throw error;
    }
    return null;
}

async function loadStatistics() {
    try {
        return await getLibraryStatistics();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath('/library?tab=achievements'));
        if (
            !(
                error instanceof ApiError ||
                error instanceof TypeError ||
                (error instanceof DOMException && error.name === 'TimeoutError')
            )
        )
            throw error;
        return null;
    }
}

export default async function LibraryAchievements() {
    const [achievements, statistics] = await Promise.all([loadAchievements(), loadStatistics()]);
    return (
        <ControlShell
            title="My Library"
            description="Your personal film history and goals."
            currentArea="library"
            clubItems={[]}
            summary={
                statistics ? (
                    <LibraryStatistics statistics={statistics} />
                ) : (
                    <section aria-label="Personal statistics unavailable">
                        <Alert tone="warning">Your statistics are temporarily unavailable.</Alert>
                        <ButtonLink href="/library?tab=achievements">Retry statistics</ButtonLink>
                    </section>
                )
            }
            items={[
                { label: 'My Ratings', href: '/library?tab=my-ratings' },
                { label: 'Watchlist', href: '/library?tab=watchlist' },
                { label: 'Achievements', href: '/library?tab=achievements', current: true },
            ]}
        >
            {achievements ? (
                <Achievements items={achievements.items} />
            ) : (
                <section aria-label="Achievements unavailable">
                    <Alert tone="warning">Your achievements are temporarily unavailable.</Alert>
                    <RetryButton />
                </section>
            )}
        </ControlShell>
    );
}
