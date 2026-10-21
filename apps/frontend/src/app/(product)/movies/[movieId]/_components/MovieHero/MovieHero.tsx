import type { TMovieDetails } from '@pickflick/contracts';

import MovieMedia from '#components/movies/MovieMedia/MovieMedia';

import styles from '../../page.module.scss';

const ratingFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

interface IMovieHeroProps {
    movie: TMovieDetails;
    title: string;
}

export default function MovieHero({ movie, title }: IMovieHeroProps) {
    return (
        <section className={styles.hero} aria-labelledby="movie-title">
            <header className={styles.titleBlock}>
                <div className={styles.titleCopy}>
                    <h1 id="movie-title">{title}</h1>
                    {movie.originalTitle && movie.originalTitle !== title ? (
                        <p>{movie.originalTitle}</p>
                    ) : null}
                    <p>
                        {movie.releaseYear ?? 'Year unavailable'} ·{' '}
                        {movie.runtime ? formatRuntime(movie.runtime) : 'Runtime unavailable'} ·{' '}
                        {movie.originalLanguage
                            ? formatLanguage(movie.originalLanguage)
                            : 'Language unavailable'}
                    </p>
                    <div className={styles.genres}>
                        {movie.genres?.length
                            ? movie.genres.map((genre) => <span key={genre}>{genre}</span>)
                            : 'Genres unavailable'}
                    </div>
                </div>
                <ul className={styles.ratings} aria-label="Provider ratings">
                    {movie.ratings.map((rating) => (
                        <li key={rating.source}>
                            <span>{rating.source.toUpperCase()}</span>{' '}
                            <strong>
                                {ratingFormat.format(rating.value)} / {rating.scale}
                            </strong>
                            {rating.voteCount !== null ? (
                                <small>{rating.voteCount.toLocaleString('en')} ratings</small>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </header>
            <MovieMedia movie={movie} title={title} />
        </section>
    );
}

const MINUTES_PER_HOUR = 60;
const languageNames = new Intl.DisplayNames('en', { type: 'language' });

function formatRuntime(minutes: number) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    return hours ? `${hours}h ${minutes % MINUTES_PER_HOUR}m` : `${minutes}m`;
}

/** Providers send ISO language codes such as `eng`; readers get the language name. */
function formatLanguage(code: string) {
    try {
        return languageNames.of(code) ?? code;
    } catch {
        return code;
    }
}
