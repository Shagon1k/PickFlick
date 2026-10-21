import type { TMovieDetails } from '@pickflick/contracts';

import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import Icon from '#components/ui/Icon/Icon';

import styles from './MovieMedia.module.scss';

/** Poster, trailer, credits and synopsis in one grid; Movie Details and the Session film share it. */
export default function MovieMedia({ movie, title }: { movie: TMovieDetails; title: string }) {
    return (
        <div className={styles.heroGrid}>
            <div className={styles.posterRegion}>
                <MoviePoster url={movie.posterUrl} title={title} />
            </div>
            <MovieCredits movie={movie} />
            <section className={styles.synopsis} aria-labelledby="synopsis-title">
                <h2 id="synopsis-title">Synopsis</h2>
                <p>{movie.overview ?? 'No synopsis is available in English.'}</p>
            </section>
            <section className={styles.trailer} aria-labelledby="trailer-title">
                <h2 id="trailer-title">Trailer</h2>
                {movie.trailers?.length ? (
                    <ul>
                        {movie.trailers.map((trailer, index) => (
                            // eslint-disable-next-line @eslint-react/no-array-index-key -- provider trailers can repeat a URL and never reorder
                            <li key={`${trailer.url}-${index}`}>
                                <a href={trailer.url} target="_blank" rel="noopener noreferrer">
                                    {trailer.name ?? 'Watch trailer'} ↗
                                    <span className="visually-hidden">
                                        {' '}
                                        (YouTube, opens in a new tab)
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No trailer is available.</p>
                )}
            </section>
        </div>
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
            </dl>
        </section>
    );
}

const MAX_CAST = 5;
