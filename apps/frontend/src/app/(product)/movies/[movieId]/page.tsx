import { movieIdSchema } from '@pickflick/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getMovieDetails } from '@/api/movies.server';
import { getSessionState, loginPath } from '@/api/session.server';
import ProductFrame from '@/components/shells/ProductFrame/ProductFrame';
import SearchCredits from '@/components/shells/ProductSearch/SearchCredits';
import Alert from '@/components/ui/Alert/Alert';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import { ApiError } from '@/lib/api.server';

import MovieHero from './_components/MovieHero/MovieHero';
import RelatedMovies from './_components/RelatedMovies/RelatedMovies';
import styles from './page.module.scss';

export const metadata: Metadata = {
    title: 'Movie Details — PickFlick',
    robots: { index: false, follow: false },
};

function unavailableMessage(reason?: string) {
    if (!reason) return 'Your session is temporarily unavailable.';
    if (reason === 'DISABLED') return 'Film details are not configured yet.';
    if (reason === 'RATE_LIMITED') return 'Film details are busy. Please try again shortly.';
    return 'The film provider is temporarily unavailable.';
}

export default async function MoviePage({ params }: { params: Promise<{ movieId: string }> }) {
    const { movieId } = await params;
    if (!movieIdSchema.safeParse(movieId).success) notFound();
    const session = await getSessionState();
    if (session === 'anonymous') redirect(loginPath(`/movies/${movieId}`));
    const response = session === 'unavailable' ? null : await loadDetails(movieId);
    const result = response?.result;
    if (result?.state === 'unavailable' && result.reason === 'NOT_FOUND') notFound();
    if (!result || result.state === 'unavailable') {
        return (
            <ProductFrame>
                <main className={styles.movieMain}>
                    <h1>Movie Details unavailable</h1>
                    <Alert tone="warning">{unavailableMessage(result?.reason)}</Alert>
                    <div className={styles.links}>
                        <ButtonLink href={`/movies/${movieId}`}>Try again</ButtonLink>
                        <ButtonLink href="/app">Back to Hub</ButtonLink>
                    </div>
                </main>
            </ProductFrame>
        );
    }
    const movie = result.data;
    const title = movie.title ?? movie.originalTitle ?? 'Untitled film';
    const imdb = response?.links.imdb;
    const relatedIds = [...new Set(movie.similarMovieIds ?? [])]
        .filter((id) => id !== movieId)
        .slice(0, 6);
    return (
        <ProductFrame>
            <main className={styles.movieMain}>
                <ButtonLink href="/app" size="small">
                    Back to Hub
                </ButtonLink>
                {result.state === 'stale' ? (
                    <Alert tone="warning">
                        Showing cached details while the provider is unavailable. Last updated{' '}
                        {new Date(result.fetchedAt).toLocaleDateString('en-US', {
                            timeZone: 'UTC',
                        })}
                        .
                    </Alert>
                ) : null}
                {result.state === 'partial' ? (
                    <Alert tone="warning">
                        Some provider details are unavailable. Available information is shown below.
                    </Alert>
                ) : null}
                <MovieHero movie={movie} title={title} />
                <nav className={styles.links} aria-label="Movie links">
                    {imdb ? (
                        <a href={imdb} target="_blank" rel="noopener noreferrer">
                            IMDb ↗<span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                    ) : null}
                    {movie.title ? (
                        <a
                            href={`https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: movie.title })}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Search Wikipedia ↗
                            <span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                    ) : null}
                </nav>
                <section className={styles.catalogCredits} aria-labelledby="catalog-credits-title">
                    <h2 id="catalog-credits-title">Catalog credits</h2>
                    <SearchCredits movies={[movie]} label="Movie catalog credits" />
                </section>
                <section className={styles.related} aria-labelledby="related-title">
                    <h2 id="related-title">Related titles</h2>
                    <p>Similar films supplied by the catalog provider.</p>
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

async function loadDetails(movieId: string) {
    try {
        return await getMovieDetails(movieId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401)
            redirect(loginPath(`/movies/${movieId}`));
        throw error;
    }
}
