import type { TMovieDetails } from '@pickflick/contracts';

import styles from '../../page.module.scss';
import MovieCredits from '../MovieCredits/MovieCredits';
import MoviePoster from '../MoviePoster/MoviePoster';

interface IMovieHeroProps {
    movie: TMovieDetails;
    title: string;
}

export default function MovieHero({ movie, title }: IMovieHeroProps) {
    return (
        <section className={styles.hero} aria-labelledby="movie-title">
            <header className={styles.titleBlock}>
                <h1 id="movie-title">{title}</h1>
                {movie.originalTitle && movie.originalTitle !== title ? (
                    <p>{movie.originalTitle}</p>
                ) : null}
                <p>
                    {movie.releaseYear ?? 'Year unavailable'} ·{' '}
                    {movie.runtime ? `${movie.runtime} min` : 'Runtime unavailable'} ·{' '}
                    {movie.originalLanguage ?? 'Language unavailable'}
                </p>
                <p>{movie.genres?.length ? movie.genres.join(' · ') : 'Genres unavailable'}</p>
                <ul className={styles.ratings} aria-label="Provider ratings">
                    {movie.ratings.map((rating) => (
                        <li key={rating.source}>
                            {rating.source.toUpperCase()}{' '}
                            <strong>
                                {rating.value} / {rating.scale}
                            </strong>
                            {rating.voteCount !== null ? ` (${rating.voteCount} ratings)` : ''}
                        </li>
                    ))}
                </ul>
            </header>
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
        </section>
    );
}
