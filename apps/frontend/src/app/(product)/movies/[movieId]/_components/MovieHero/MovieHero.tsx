import type { TMovieDetails } from '@pickflick/contracts';
import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import FilmMeta from '#components/movies/FilmMeta/FilmMeta';
import MovieMedia from '#components/movies/MovieMedia/MovieMedia';
import TicketPoster from '#components/movies/TicketPoster/TicketPoster';
import WatchlistBookmark from '#components/movies/WatchlistBookmark/WatchlistBookmark';
import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';

import styles from '../../page.module.scss';

const ratingFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const voteFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// One rating keeps the header calm: IMDb first, then Kinopoisk, then whatever the source sent.
const RATING_PRIORITY = ['imdb', 'kinopoisk'];
const RATING_LABELS: Record<string, string> = {
    imdb: 'IMDb',
    kinopoisk: 'Kinopoisk',
    tmdb: 'TMDB',
};

interface IMovieHeroProps {
    movie: TMovieDetails;
    title: string;
}

export default function MovieHero({ movie, title }: IMovieHeroProps) {
    return (
        <section className={styles.hero} aria-labelledby="movie-title">
            {/* On phones the header becomes the film ticket, its rating the stub, as in Sessions. */}
            <header className={clsx(styles.titleBlock, ticket.ticket)} data-film>
                <TicketPoster corner={<WatchlistBookmark />} title={title} url={movie.posterUrl} />
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
                {/* Rate and the poster's Watchlist ribbon are placeholders until Phase 15. */}
                <div className={clsx(ticket.rail, ticket.stub)}>
                    <Rating ratings={movie.ratings} />
                    <div className={ticket.railCell}>
                        <Button aria-label="Rate this film (coming soon)" disabled variant="cell">
                            <Icon name="ratings" />
                            Rate
                        </Button>
                    </div>
                </div>
            </header>
            <MovieMedia
                hidePhonePoster
                movie={movie}
                posterCorner={<WatchlistBookmark />}
                title={title}
            />
        </section>
    );
}

function Rating({ ratings }: { ratings: TMovieDetails['ratings'] }) {
    const rating =
        RATING_PRIORITY.map((source) => ratings.find((item) => item.source === source)).find(
            Boolean,
        ) ?? ratings.at(0);
    if (!rating)
        return (
            <p className={clsx(ticket.railItem, styles.rating)}>
                <Icon name="globe" />
                <strong aria-hidden="true">—</strong>
                <span className="visually-hidden">No ratings yet</span>
            </p>
        );
    const label = RATING_LABELS[rating.source] ?? rating.source;
    // The prototype shows a mark, not the source name; readers and the tooltip still get it.
    return (
        <p className={clsx(ticket.railItem, styles.rating)} title={`${label} rating`}>
            <Icon name="globe" />
            <span className="visually-hidden">{label} rating</span>
            <span>
                <strong>{ratingFormat.format(rating.value)}</strong>
                <span className="visually-hidden"> out of {rating.scale}</span>
                {rating.voteCount === null ? null : (
                    <small>
                        {' '}
                        {voteFormat.format(rating.voteCount)}
                        <span className="visually-hidden"> ratings</span>
                    </small>
                )}
            </span>
        </p>
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
