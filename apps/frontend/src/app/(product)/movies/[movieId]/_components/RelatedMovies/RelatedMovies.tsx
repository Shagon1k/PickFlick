import Link from 'next/link';

import { getMovieDetails } from '#api/movies.server';
import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import { formatMovieTitle } from '#lib/format';

import styles from '../../page.module.scss';

type TRelatedResult = Awaited<ReturnType<typeof getMovieDetails>>['result'];

function describeRelated(result: TRelatedResult) {
    if (result.state === 'unavailable')
        return {
            posterUrl: null,
            posterTitle: 'Related film',
            name: 'Related film unavailable',
            label: 'Open details to try again',
        };
    const title = formatMovieTitle(result.data);
    return {
        posterUrl: result.data.posterUrl,
        posterTitle: title,
        name: title,
        label:
            result.state === 'stale'
                ? 'Cached details'
                : String(result.data.releaseYear ?? 'Year unavailable'),
    };
}

export default async function RelatedMovies({ ids }: { ids: string[] }) {
    const movies = await Promise.all(
        ids.map(async (id) => ({ id, ...(await getMovieDetails(id)) })),
    );
    return (
        <div className={styles.relatedGrid}>
            {movies.map(({ id, result }) => {
                const card = describeRelated(result);
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
                            url={card.posterUrl}
                            title={card.posterTitle}
                        />
                        <strong>{card.name}</strong>
                        <span>{card.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
