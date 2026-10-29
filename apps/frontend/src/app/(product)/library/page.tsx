import { libraryQuerySchema, type TLibraryQuery } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getPersonalAchievements } from '#api/achievements.server';
import { buildLoginPath, getSessionState } from '#api/auth-session.server';
import { getLibrary } from '#api/library.server';
import Achievements from '#components/achievements/Achievements/Achievements';
import RetryButton from '#components/shells/RetryButton/RetryButton';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';

import LibraryShell from './_components/LibraryShell/LibraryShell';
import LibraryTable from './_components/LibraryTable/LibraryTable';
import { buildLibraryPath } from './library-path';
import { loadLibraryRead } from './load-library-read';

export const metadata: Metadata = {
    title: 'My Library — PickFlick',
    robots: { index: false, follow: false },
};

async function AchievementContent() {
    const achievements = await loadLibraryRead(
        getPersonalAchievements,
        '/library?tab=achievements',
    );
    return achievements ? (
        <Achievements items={achievements.items} />
    ) : (
        <section aria-label="Achievements unavailable">
            <Alert tone="warning">Your achievements are temporarily unavailable.</Alert>
            <RetryButton />
        </section>
    );
}

async function LibraryContent({
    query,
    isValid,
    isAuthenticated,
}: {
    query: TLibraryQuery;
    isValid: boolean;
    isAuthenticated: boolean;
}) {
    const library =
        isValid && isAuthenticated
            ? await loadLibraryRead(() => getLibrary(query), buildLibraryPath(query))
            : null;
    const title = query.tab === 'watchlist' ? 'Watchlist' : 'My Ratings';
    return (
        <>
            {!isValid && (
                <section aria-label="Invalid Library filters">
                    <Alert tone="warning">
                        These Library filters are invalid. Clear them and try again.
                    </Alert>
                    <ButtonLink href="/library">Clear filters</ButtonLink>
                </section>
            )}
            {library && <LibraryTable key={query.tab} library={library} query={query} />}
            {isValid && !library && (
                <section aria-label={`${title} unavailable`}>
                    <Alert tone="warning">
                        {query.tab === 'watchlist'
                            ? 'Your Watchlist is temporarily unavailable.'
                            : 'Your ratings are temporarily unavailable.'}
                    </Alert>
                    <ButtonLink href={buildLibraryPath(query)}>Try again</ButtonLink>
                </section>
            )}
        </>
    );
}

export default async function LibraryPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const parameters = await searchParams;
    const isAchievements = parameters.tab === 'achievements';
    const parsed = libraryQuerySchema.safeParse(parameters);
    const query = parsed.success ? parsed.data : libraryQuerySchema.parse({});
    const current = isAchievements ? 'achievements' : query.tab;
    const returnPath = isAchievements ? '/library?tab=achievements' : buildLibraryPath(query);
    const session = await getSessionState();
    if (session === 'anonymous') redirect(buildLoginPath(returnPath));
    return (
        <LibraryShell
            current={current}
            returnPath={returnPath}
            shouldShowStatistics={isAchievements || (parsed.success && session === 'authenticated')}
        >
            {isAchievements ? (
                <AchievementContent />
            ) : (
                <LibraryContent
                    query={query}
                    isValid={parsed.success}
                    isAuthenticated={session === 'authenticated'}
                />
            )}
        </LibraryShell>
    );
}
