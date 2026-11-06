import type { TMovieDetails, TPersonalMovieRating, TWatchlistItem } from '@pickflick/contracts';
import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import FilmMeta from '#components/movies/FilmMeta/FilmMeta';
import GlobalMovieRating from '#components/movies/GlobalMovieRating/GlobalMovieRating';
import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import PersonalRating from '#components/movies/PersonalRating/PersonalRating';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import WatchlistBookmark from '#components/movies/WatchlistBookmark/WatchlistBookmark';

import styles from '../../page.module.scss';

interface IMovieHeroProps {
    movie: TMovieDetails;
    title: string;
    rating: TPersonalMovieRating | null;
    watchlistItem: TWatchlistItem | null;
}

export default function MovieHero({ movie, title, rating, watchlistItem }: IMovieHeroProps) {
    return (
        <section className={styles.hero} aria-labelledby="movie-title">
            {/* On phones the header becomes the film ticket, its rating the stub, as in Sessions. */}
            <header className={clsx(styles.titleBlock, ticket.ticket)} data-film>
                <TicketPoster
                    corner={<WatchlistBookmark movieId={movie.id} item={watchlistItem} />}
                    title={title}
                    url={movie.posterUrl}
                />
                <div className={clsx(styles.titleCopy, ticket.copy)}>
                    <h1 id="movie-title">{title}</h1>
                    {movie.originalTitle && movie.originalTitle !== title ? (
                        <p>{movie.originalTitle}</p>
                    ) : null}
                    <FilmMeta
                        className={styles.filmMeta}
                        language={
                            movie.originalLanguage ? formatLanguage(movie.originalLanguage) : null
                        }
                        movie={movie}
                    />
                </div>
                <div className={clsx(ticket.rail, ticket.stub)}>
                    <GlobalMovieRating ratings={movie.ratings} />
                    <div className={ticket.railCell}>
                        <PersonalRating movieId={movie.id} rating={rating} />
                    </div>
                </div>
            </header>
            <MovieMedia
                shouldHidePhonePoster
                movie={movie}
                posterCorner={<WatchlistBookmark movieId={movie.id} item={watchlistItem} />}
                title={title}
            />
        </section>
    );
}

const languageNames = new Intl.DisplayNames('en', { type: 'language' });

/** Providers send ISO language codes such as `eng`; readers get the language name. */
function formatLanguage(code: string) {
    try {
        return languageNames.of(code) ?? code;
    } catch {
        return code;
    }
}
