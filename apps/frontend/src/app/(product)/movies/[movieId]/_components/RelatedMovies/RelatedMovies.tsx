import type { TMovieDetails } from '@pickflick/contracts';
import Link from 'next/link';

import { getMovieDetails } from '#api/movies.server';
import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';

import styles from '../../page.module.scss';

interface IRelatedMoviesProps {
    ids: string[];
    primaryMovie: TMovieDetails;
}

export default async function RelatedMovies({ ids, primaryMovie }: IRelatedMoviesProps) {
    const movies = await Promise.all(
        ids.map(async (id) => ({ id, ...(await getMovieDetails(id)) })),
    );
    const available = [
        primaryMovie,
        ...movies.flatMap(({ result }) => (result.state === 'unavailable' ? [] : [result.data])),
    ];
    return (
        <>
            <div className={styles.relatedGrid}>
                {movies.map(({ id, result }) => {
                    let label = 'Open details to try again';
                    if (result.state !== 'unavailable')
                        label =
                            result.state === 'stale'
                                ? 'Cached details'
                                : String(result.data.releaseYear ?? 'Year unavailable');
                    return (
                        <Link
                            className={styles.relatedCard}
                            href={`/movies/${id}`}
                            key={id}
                            prefetch={false}
                        >
                            <MoviePoster
                                className={styles.relatedPoster}
                                url={result.state === 'unavailable' ? null : result.data.posterUrl}
                                title={
                                    result.state === 'unavailable'
                                        ? 'Related film'
                                        : (result.data.title ?? 'Untitled film')
                                }
                            />
                            <strong>
                                {result.state === 'unavailable'
                                    ? 'Related film unavailable'
                                    : (result.data.title ?? 'Untitled film')}
                            </strong>
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </div>
            <SearchCredits movies={available} label="Movie catalog credits" />
        </>
    );
}
