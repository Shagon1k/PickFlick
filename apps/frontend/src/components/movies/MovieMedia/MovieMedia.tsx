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
                    <>
                        <p>Our film sources have no trailer for this Movie.</p>
                        <a
                            href={buildTrailerSearch(title, movie.releaseYear)}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            Search YouTube for a trailer ↗
                            <span className="visually-hidden"> (opens in a new tab)</span>
                        </a>
                    </>
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
