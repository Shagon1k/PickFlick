import { getPosterPath, type TNominationMovie } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './NominationMovieCard.module.scss';

export default function NominationMovieCard({
    movie,
    author,
    badge,
    score,
    maxGenres,
    isLoading = false,
}: {
    movie: TNominationMovie;
    author: string | null;
    badge?: string;
    score?: ReactNode;
    maxGenres?: number;
    isLoading?: boolean;
}) {
    return (
        <div
            className={styles.card}
            data-score={score ? true : undefined}
            data-color-reveal-trigger
            data-color-reveal-surface
        >
            <ColorReveal variant="surface" />
            <Link
                aria-label={`${movie.title ?? 'Movie title unavailable'}${movie.year ? ` (${movie.year})` : ''}`}
                className={styles.film}
                href={`/movies/${movie.id}`}
                prefetch={false}
            >
                <SearchPoster
                    className={styles.poster}
                    url={getPosterPath(movie.id)}
                    withColorReveal
                    isLoading={isLoading}
                />
                <div className={styles.info}>
                    <h3>
                        <span>
                            {isLoading ? (
                                <Skeleton text={movie.title ?? 'Movie title unavailable'} />
                            ) : (
                                (movie.title ?? 'Movie title unavailable')
                            )}
                        </span>
                        {badge ? (
                            <span className={styles.badge}>
                                {isLoading ? <Skeleton text={badge} /> : badge}
                            </span>
                        ) : null}
                    </h3>
                    {author !== null ? (
                        <p className={styles.author}>
                            {isLoading ? <Skeleton text={'by ' + author} /> : <>by {author}</>}
                        </p>
                    ) : null}
                    {movie.genres.length ? (
                        <ul className={styles.genres} aria-label="Genres">
                            {movie.genres.slice(0, maxGenres).map((genre) => (
                                <li key={genre}>{isLoading ? <Skeleton text={genre} /> : genre}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </Link>
            {score ? <div className={styles.score}>{score}</div> : null}
        </div>
    );
}
