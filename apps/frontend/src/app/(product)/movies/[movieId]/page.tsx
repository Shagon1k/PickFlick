import { HTTP_STATUS, movieIdSchema } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getMovieDetails } from '#api/movies.server';
import { getPersonalRating } from '#api/personal-rating.server';
import { buildLoginPath, getSessionState } from '#api/session.server';
import { getWatchlistItem } from '#api/watchlist.server';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import Alert from '#components/ui/Alert/Alert';
import ButtonLink from '#components/ui/Button/ButtonLink';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';
import { ApiError } from '#lib/api.server';
import { formatUtcDate } from '#lib/format';

import MovieHero from './_components/MovieHero/MovieHero';
import MovieLinks from './_components/MovieLinks/MovieLinks';
import RelatedMovies from './_components/RelatedMovies/RelatedMovies';
import styles from './page.module.scss';

const MAX_RELATED_MOVIES = 6;

export const metadata: Metadata = {
    title: 'Movie Details — PickFlick',
    robots: { index: false, follow: false },
};

function getUnavailableMessage(reason?: string) {
    if (!reason) return 'Your session is temporarily unavailable.';
    if (reason === 'DISABLED') return 'Film details are not configured yet.';
    if (reason === 'RATE_LIMITED') return 'Film details are busy. Please try again shortly.';
    return 'The film provider is temporarily unavailable.';
}

export default async function MoviePage({ params }: { params: Promise<{ movieId: string }> }) {
    const { movieId } = await params;
    if (!movieIdSchema.safeParse(movieId).success) notFound();
    const response = await loadDetails(movieId);
    const result = response?.result;
    if (result?.state === 'unavailable' && result.reason === 'NOT_FOUND') notFound();
    if (!result || result.state === 'unavailable') {
        return <MovieUnavailable movieId={movieId} reason={result?.reason} />;
    }
    const [rating, watchlistItem] = await loadPersonalState(movieId);
    const movie = result.data;
    const title = movie.title ?? movie.originalTitle ?? 'Untitled film';
    const relatedIds = [...new Set(movie.similarMovieIds ?? [])]
        .filter((id) => id !== movieId)
        .slice(0, MAX_RELATED_MOVIES);
    return (
        <ProductFrame currentArea="movie">
            <main className={styles.movieMain}>
                {result.state === 'stale' ? (
                    <Alert tone="warning">
                        Showing cached details while the provider is unavailable. Last updated{' '}
                        {formatUtcDate(result.fetchedAt)}.
                    </Alert>
                ) : null}
                {result.state === 'partial' ? (
                    <Alert tone="warning">
                        Some provider details are unavailable. Available information is shown below.
                    </Alert>
                ) : null}
                <MovieHero
                    movie={movie}
                    title={title}
                    rating={rating}
                    watchlistItem={watchlistItem}
                />
                <MovieLinks
                    imdb={response?.links.imdb ?? null}
                    kinopoisk={response?.links.kinopoisk ?? null}
                    letterboxd={response?.links.letterboxd ?? null}
                    title={movie.title}
                />
                <SprocketDivider variant="section" />
                <section className={styles.related} aria-labelledby="related-title">
                    <h2 id="related-title">You may also like</h2>
                    {relatedIds.length ? (
                        <Suspense fallback={<p role="status">Loading related titles…</p>}>
                            <RelatedMovies ids={relatedIds} />
                        </Suspense>
                    ) : (
                        <p>No related titles are available.</p>
                    )}
                </section>
            </main>
        </ProductFrame>
    );
}

/** Details for a signed-in visitor; null while the session check itself is unavailable. */
async function loadDetails(movieId: string) {
    const session = await getSessionState();
    if (session === 'anonymous') redirect(buildLoginPath(`/movies/${movieId}`));
    if (session === 'unavailable') return null;
    try {
        return await getMovieDetails(movieId);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/movies/${movieId}`));
        throw error;
    }
}

function MovieUnavailable({ movieId, reason }: { movieId: string; reason?: string }) {
    return (
        <ProductFrame>
            <main className={styles.movieMain}>
                <h1>Movie Details unavailable</h1>
                <Alert tone="warning">{getUnavailableMessage(reason)}</Alert>
                <div className={styles.links}>
                    <ButtonLink href={`/movies/${movieId}`}>Try again</ButtonLink>
                    <ButtonLink href="/app">Back to Hub</ButtonLink>
                </div>
            </main>
        </ProductFrame>
    );
}

/** The rating and Watchlist controls are secondary: a failed read shows them empty, not a broken page. */
async function loadPersonalState(movieId: string) {
    try {
        return await Promise.all([getPersonalRating(movieId), getWatchlistItem(movieId)]);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED)
            redirect(buildLoginPath(`/movies/${movieId}`));
        console.error('Personal film state unavailable.', { movieId, error });
        return [null, null] as const;
    }
}
