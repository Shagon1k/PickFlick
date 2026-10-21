import { HTTP_STATUS, type TSession } from '@pickflick/contracts';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getMovieDetails } from '#api/movies.server';
import { buildLoginPath } from '#api/session.server';
import { getSessionRoster } from '#api/session-roster.server';
import { getSession } from '#api/sessions.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import ButtonLink from '#components/ui/Button/ButtonLink';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';

import SessionDetails from './_components/SessionDetails/SessionDetails';
import SessionProgress from './_components/SessionProgress/SessionProgress';
import styles from './page.module.scss';

export const metadata = { title: 'Session — PickFlick' };
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    await connection();
    const { sessionId } = await params;
    let session;
    let roster;
    try {
        [session, roster] = await Promise.all([getSession(sessionId), getSessionRoster(sessionId)]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/sessions/${sessionId}`));
        if (error instanceof ApiError && NOT_FOUND_STATUSES.includes(error.status)) notFound();
        return (
            <ProductFrame>
                <SessionProgress sessionId={sessionId} version={null} />
                <main className={styles.main}>
                    <h1>Session unavailable</h1>
                    <p role="alert">We could not load this Session. Try again shortly.</p>
                    <ButtonLink href="/app">Back to your Clubs</ButtonLink>
                </main>
            </ProductFrame>
        );
    }
    const [movie, renderedAt] = await Promise.all([loadFilm(session), getRequestTime()]);
    return (
        <ProductFrame currentArea="session" sessionBackHref={`/clubs/${session.clubId}`}>
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
        </ProductFrame>
    );
}

const FILM_PHASES = new Set<TSession['phase']>(['WATCHING', 'RATING', 'COMPLETED']);

/** Details for the screening's film; the Session stays usable and says so when they are missing. */
async function loadFilm(session: TSession) {
    if (!session.movieId || !FILM_PHASES.has(session.phase)) return null;
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
