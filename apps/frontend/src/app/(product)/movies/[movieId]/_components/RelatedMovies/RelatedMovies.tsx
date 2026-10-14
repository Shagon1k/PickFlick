import Link from 'next/link';

import { getMovieDetails } from '@/api/movies.server';
import SearchCredits from '@/components/movies/SearchCredits/SearchCredits';

import styles from '../../page.module.scss';
import MoviePoster from '../MoviePoster/MoviePoster';

interface IRelatedMoviesProps {
    ids: string[];
}

export default async function RelatedMovies({ ids }: IRelatedMoviesProps) {
    const movies = await Promise.all(
        ids.map(async (id) => ({ id, ...(await getMovieDetails(id)) })),
    );
    const available = movies.flatMap(({ result }) =>
        result.state === 'unavailable' ? [] : [result.data],
    );
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
            {available.length ? (
                <SearchCredits movies={available} label="Related catalog credits" />
            ) : null}
        </>
    );
}
