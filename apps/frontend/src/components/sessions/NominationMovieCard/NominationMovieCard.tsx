import { getPosterPath, type TNominationMovie } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';

import styles from './NominationMovieCard.module.scss';

export default function NominationMovieCard({
    movie,
    author,
    badge,
    score,
    maxGenres,
}: {
    movie: TNominationMovie;
    author: string | null;
    badge?: string;
    score?: ReactNode;
    maxGenres?: number;
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
                />
                <div className={styles.info}>
                    <h3>
                        <span>{movie.title ?? 'Movie title unavailable'}</span>
                        {badge ? <span className={styles.badge}>{badge}</span> : null}
                    </h3>
                    {author !== null ? <p className={styles.author}>by {author}</p> : null}
                    {movie.genres.length ? (
                        <ul className={styles.genres} aria-label="Genres">
                            {movie.genres.slice(0, maxGenres).map((genre) => (
                                <li key={genre}>{genre}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </Link>
            {score ? <div className={styles.score}>{score}</div> : null}
        </div>
    );
}
