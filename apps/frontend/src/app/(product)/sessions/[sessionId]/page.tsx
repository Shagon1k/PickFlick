import { HTTP_STATUS, isFilmSessionPhase, type TSession } from '@pickflick/contracts';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { buildLoginPath } from '#api/auth-session.server';
import { getMovieDetails } from '#api/movies.server';
import { getSessionRoster } from '#api/session-roster.server';
import { getSession } from '#api/sessions.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '#components/shells/shell-navigation';
import SystemState from '#components/shells/SystemState/SystemState';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import SessionCreatedToast from './_components/SessionCreatedToast/SessionCreatedToast';
import SessionDetails from './_components/SessionDetails/SessionDetails';
import SessionLoading from './_components/SessionLoading/SessionLoading';
import SessionProgress from './_components/SessionProgress/SessionProgress';

export const metadata = { title: 'Session — PickFlick' };
export default async function SessionPage({
    params,
    searchParams,
}: {
    params: Promise<{ sessionId: string }>;
    searchParams: Promise<{ created?: string }>;
}) {
    await connection();
    const { sessionId } = await params;
    const { created } = await searchParams;
    let session;
    try {
        session = await getSession(sessionId);
    } catch (error) {
        return renderSessionFailure(error, sessionId);
    }
    return (
        <Suspense fallback={<SessionLoading session={session} />}>
            <SessionContent session={session} created={created} />
        </Suspense>
    );
}

async function SessionContent({ session, created }: { session: TSession; created?: string }) {
    let roster;
    let movie;
    let renderedAt;
    try {
        [roster, movie, renderedAt] = await Promise.all([
            getSessionRoster(session.id),
            loadFilm(session),
            getRequestTime(),
        ]);
    } catch (error) {
        return renderSessionFailure(error, session.id);
    }
    return (
        <ProductFrame
            clubItems={buildClubNavigation(session.clubId, null)}
            currentArea="session"
            sessionBackHref={`/clubs/${session.clubId}`}
        >
            <SessionProgress
                sessionId={session.id}
                version={Math.min(session.progressVersion, roster.progressVersion)}
            />
            <SessionDetails
                session={session}
                roster={roster}
                movie={movie}
                renderedAt={renderedAt}
            />
            {created ? <SessionCreatedToast sessionId={session.id} /> : null}
        </ProductFrame>
    );
}

function renderSessionFailure(error: unknown, sessionId: string) {
    if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
        redirect(buildLoginPath(`/sessions/${sessionId}`));
    if (error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status))
        return <SystemState isSignedIn variant="members-only" />;
    return (
        <SystemState
            description="We could not load this Session. It reloads by itself once it can."
            isSignedIn
            retryHref={`/sessions/${sessionId}`}
            title="Session unavailable"
            variant="application-error"
        >
            <SessionProgress sessionId={sessionId} version={null} />
        </SystemState>
    );
}

/** Details for the screening's film; the Session stays usable and says so when they are missing. */
async function loadFilm(session: TSession) {
    if (!session.movieId || !isFilmSessionPhase(session.phase)) return null;
    try {
        const { result } = await getMovieDetails(session.movieId);
        return result.state === 'unavailable' ? null : result.data;
    } catch (error) {
        console.error('Session film details unavailable.', { sessionId: session.id, error });
        return null;
    }
}

/** The request's clock anchors relative deadlines so the server and hydrated text agree. */
async function getRequestTime() {
    return Date.now();
}
