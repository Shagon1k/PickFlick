import { HTTP_STATUS } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { buildLoginPath, getSessionState } from '#api/session.server';
import { getWatchlist } from '#api/watchlist.server';
import ControlShell from '#components/shells/ControlShell/ControlShell';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';

import WatchlistTable from './_components/WatchlistTable/WatchlistTable';

export const metadata: Metadata = {
    title: 'My Library — PickFlick',
    robots: { index: false, follow: false },
};

async function loadWatchlist() {
    const session = await getSessionState();
    if (session === 'anonymous') redirect(buildLoginPath('/library?tab=watchlist'));
    if (session === 'unavailable') return null;
    try {
        return await getWatchlist();
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath('/library?tab=watchlist'));
        if (error instanceof ApiError || error instanceof TypeError) return null;
        throw error;
    }
}

export default async function LibraryPage() {
    const watchlist = await loadWatchlist();
    return (
        <ControlShell
            title="My Library"
            description="Films you want to watch, at your own pace."
            currentArea="library"
            clubItems={[]}
            items={[{ label: 'Watchlist', href: '/library?tab=watchlist', current: true }]}
        >
            {watchlist ? (
                <WatchlistTable items={watchlist.items} />
            ) : (
                <section aria-label="Watchlist unavailable">
                    <Alert tone="warning">Your Watchlist is temporarily unavailable.</Alert>
                    <ButtonLink href="/library?tab=watchlist">Try again</ButtonLink>
                </section>
            )}
        </ControlShell>
    );
}
