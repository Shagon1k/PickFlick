import { HTTP_STATUS, libraryQuerySchema, type TLibraryQuery } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getLibrary, getLibraryStatistics } from '#api/library.server';
import { buildLoginPath, getSessionState } from '#api/session.server';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';

import LibraryAchievements from './_components/LibraryAchievements/LibraryAchievements';
import LibraryStatistics from './_components/LibraryStatistics/LibraryStatistics';
import LibraryTable from './_components/LibraryTable/LibraryTable';
import { buildLibraryPath } from './library-path';

export const metadata: Metadata = {
    title: 'My Library — PickFlick',
    robots: { index: false, follow: false },
};

async function loadLibrary(query: TLibraryQuery) {
    const path = buildLibraryPath(query);
    try {
        return await getLibrary(query);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(path));
        if (error instanceof ApiError || error instanceof TypeError) return null;
        throw error;
    }
}

async function loadStatistics(query: TLibraryQuery) {
    try {
        return await getLibraryStatistics();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(buildLibraryPath(query)));
        if (
            error instanceof ApiError ||
            error instanceof TypeError ||
            (error instanceof DOMException && error.name === 'TimeoutError')
        )
            return null;
        throw error;
    }
}

export default async function LibraryPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const parameters = await searchParams;
    if (parameters.tab === 'achievements') return <LibraryAchievements />;
    const parsed = libraryQuerySchema.safeParse(parameters);
    const query = parsed.success ? parsed.data : libraryQuerySchema.parse({});
    const session = await getSessionState();
    if (session === 'anonymous') redirect(buildLoginPath(buildLibraryPath(query)));
    const [library, statistics] =
        parsed.success && session === 'authenticated'
            ? await Promise.all([loadLibrary(query), loadStatistics(query)])
            : [null, null];
    const title = query.tab === 'watchlist' ? 'Watchlist' : 'My Ratings';
    return (
        <ControlShell
            title="My Library"
            description="Your ratings and films to watch, at your own pace."
            currentArea="library"
            clubItems={[]}
            summary={
                parsed.success &&
                (statistics ? (
                    <LibraryStatistics statistics={statistics} />
                ) : (
                    <section aria-label="Personal statistics unavailable">
                        <Alert tone="warning">Your statistics are temporarily unavailable.</Alert>
                        <ButtonLink href={buildLibraryPath(query)}>Retry statistics</ButtonLink>
                    </section>
                ))
            }
            items={[
                {
                    label: 'My Ratings',
                    href: '/library?tab=my-ratings',
                    current: query.tab === 'my-ratings',
                },
                {
                    label: 'Watchlist',
                    href: '/library?tab=watchlist',
                    current: query.tab === 'watchlist',
                },
                { label: 'Achievements', href: '/library?tab=achievements' },
            ]}
        >
            {!parsed.success && (
                <section aria-label="Invalid Library filters">
                    <Alert tone="warning">
                        These Library filters are invalid. Clear them and try again.
                    </Alert>
                    <ButtonLink href="/library">Clear filters</ButtonLink>
                </section>
            )}
            {library && <LibraryTable key={query.tab} library={library} query={query} />}
            {parsed.success && !library && (
                <section aria-label={`${title} unavailable`}>
                    <Alert tone="warning">
                        {query.tab === 'watchlist'
                            ? 'Your Watchlist is temporarily unavailable.'
                            : 'Your ratings are temporarily unavailable.'}
                    </Alert>
                    <ButtonLink href={buildLibraryPath(query)}>Try again</ButtonLink>
                </section>
            )}
        </ControlShell>
    );
}
