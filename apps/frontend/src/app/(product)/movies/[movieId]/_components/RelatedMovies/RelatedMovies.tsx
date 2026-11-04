import Link from 'next/link';

import { getMovieDetails } from '#api/movies.server';
import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';

import styles from '../../page.module.scss';

export default async function RelatedMovies({ ids }: { ids: string[] }) {
    const movies = await Promise.all(
        ids.map(async (id) => ({ id, ...(await getMovieDetails(id)) })),
    );
    return (
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
                        data-color-reveal-trigger
                        data-color-reveal-surface
                        href={`/movies/${id}`}
                        key={id}
                        prefetch={false}
                    >
                        <ColorReveal variant="surface" />
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
    );
}
