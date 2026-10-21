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
                        {movie.runtime ? `${movie.runtime} min` : 'Runtime unavailable'} ·{' '}
                        {movie.originalLanguage ?? 'Language unavailable'}
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
