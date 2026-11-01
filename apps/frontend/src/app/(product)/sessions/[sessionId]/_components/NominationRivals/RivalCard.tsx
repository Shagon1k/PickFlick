import { getPosterPath, type TNominationMovie } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';

import styles from './NominationRivals.module.scss';

export default function RivalCard({
    movie,
    author,
    badge,
    children,
}: {
    movie: TNominationMovie;
    author: string | null;
    badge?: string;
    children: ReactNode;
}) {
    return (
        <li className={styles.card}>
            <SearchPoster className={styles.poster} url={getPosterPath(movie.id)} />
            <div className={styles.info}>
                <h4>
                    <Link href={`/movies/${movie.id}`}>
                        {movie.title ?? 'Movie title unavailable'}
                    </Link>
                    {badge ? <span className={styles.winner}>{badge}</span> : null}
                </h4>
                {author !== null ? <span className={styles.meta}>by {author}</span> : null}
                {movie.genres.length ? (
                    <ul className={styles.genres} aria-label="Genres">
                        {movie.genres.map((genre) => (
                            <li key={genre}>{genre}</li>
                        ))}
                    </ul>
                ) : null}
            </div>
            {children}
        </li>
    );
}
