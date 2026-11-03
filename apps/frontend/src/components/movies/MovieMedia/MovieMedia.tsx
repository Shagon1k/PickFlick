import type { TMovieDetails } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import TrailerPlayer from '#components/movies/TrailerPlayer/TrailerPlayer';
import Icon from '#components/ui/Icon/Icon';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './MovieMedia.module.scss';

interface IMovieMediaLayoutProps {
    title: string;
    filmHref?: string;
    shouldHidePhonePoster?: boolean;
    posterCorner?: ReactNode;
    variant?: 'movie' | 'session';
}

type TMovieMediaProps = IMovieMediaLayoutProps &
    ({ movie: TMovieDetails; isLoading?: false } | { movie?: never; isLoading: true });

/**
 * Poster, trailer, credits and synopsis in one grid; Movie Details and the Session film share it.
 * Outside Movie Details, `filmHref` turns the poster into the way to the Movie page.
 */
export default function MovieMedia({
    movie,
    title,
    filmHref,
    shouldHidePhonePoster = false,
    posterCorner,
    variant = 'movie',
    isLoading = false,
}: TMovieMediaProps) {
    const poster = (
        <MoviePoster url={movie?.posterUrl ?? null} title={title} isLoading={isLoading} />
    );
    return (
        <div className={styles.heroGrid} data-variant={variant}>
            <div
                className={styles.posterRegion}
                data-color-reveal-trigger
                data-phone-hidden={shouldHidePhonePoster || undefined}
            >
                {filmHref ? (
                    <Link
                        aria-label={`${title}: film details`}
                        className={styles.posterLink}
                        href={filmHref}
                    >
                        {poster}
                        <span aria-hidden="true" className={styles.posterCaption}>
                            Film details →
                        </span>
                    </Link>
                ) : (
                    poster
                )}
                {posterCorner}
            </div>
            {movie ? <MovieCredits movie={movie} /> : <CreditsSkeleton />}
            <section className={styles.synopsis} aria-labelledby="synopsis-title">
                <h2 id="synopsis-title">Synopsis</h2>
                {movie ? (
                    <p>{movie.overview ?? 'No synopsis is available in English.'}</p>
                ) : (
                    <p className={styles.synopsisSkeleton}>
                        <Skeleton />
                        <Skeleton />
                        <Skeleton width="half" />
                    </p>
                )}
            </section>
            <div className={styles.trailer}>
                {movie ? (
                    <TrailerPlayer
                        key={movie.id}
                        movieId={movie.id}
                        searchUrl={buildTrailerSearch(title, movie.releaseYear)}
                        title={title}
                        trailers={movie.trailers ?? []}
                    />
                ) : (
                    <div className={styles.trailerSkeleton}>
                        <Skeleton shouldFill />
                    </div>
                )}
            </div>
        </div>
    );
}

const CREDIT_ROW_COUNT = 5;

function CreditsSkeleton() {
    return (
        <section className={styles.credits}>
            <dl>
                {Array.from({ length: CREDIT_ROW_COUNT }, (_, index) => (
                    <div key={index}>
                        <dt>
                            <Skeleton width="half" />
                        </dt>
                        <dd className={styles.creditSkeleton}>
                            <Skeleton width="half" />
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function MovieCredits({ movie }: { movie: TMovieDetails }) {
    return (
        <section className={styles.credits} aria-labelledby="credits-title">
            <h2 id="credits-title" className="visually-hidden">
                Credits
            </h2>
            <dl>
                <div>
                    <dt>
                        <Icon name="profile" />
                        Director
                    </dt>
                    <dd>
                        {movie.directors?.length
                            ? movie.directors.map(({ name }) => name).join(', ')
                            : 'Unavailable'}
                    </dd>
                </div>
                {movie.writers?.length ? (
                    <div>
                        <dt>
                            <Icon name="edit" />
                            Writer
                        </dt>
                        <dd>{movie.writers.map(({ name }) => name).join(', ')}</dd>
                    </div>
                ) : null}
                <div>
                    <dt>
                        <Icon name="members" />
                        Actors
                    </dt>
                    <dd>
                        {movie.cast?.length
                            ? [...new Set(movie.cast.map(({ name }) => name))]
                                  .slice(0, MAX_CAST)
                                  .join(', ')
                            : 'Unavailable'}
                    </dd>
                </div>
                {movie.budget ? (
                    <div>
                        <dt>
                            <Icon name="pricing" />
                            Budget
                        </dt>
                        <dd>{formatDollars(movie.budget)}</dd>
                    </div>
                ) : null}
                {movie.revenue ? (
                    <div>
                        <dt>
                            <Icon name="chart" />
                            Revenue
                        </dt>
                        <dd>{formatDollars(movie.revenue)}</dd>
                    </div>
                ) : null}
            </dl>
        </section>
    );
}

const MAX_CAST = 5;

/** A labelled search, not a claimed match: the providers sent no verified trailer. */
function buildTrailerSearch(title: string, year: number | null) {
    const query = [title, year, 'trailer'].filter(Boolean).join(' ');
    return `https://www.youtube.com/results?${new URLSearchParams({ search_query: query }).toString()}`;
}

const dollars = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
});

/** Provider amounts are whole US dollars; the prototype reads them as `$168M`. */
function formatDollars(amount: number) {
    return dollars.format(amount);
}
