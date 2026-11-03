import type { TMovieDetails } from '@pickflick/contracts';
import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import Icon from '#components/ui/Icon/Icon';
import { formatAverage } from '#lib/format';

import styles from './GlobalMovieRating.module.scss';

const voteFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const RATING_PRIORITY = ['imdb', 'kinopoisk'];
const RATING_LABELS: Record<string, string> = {
    imdb: 'IMDb',
    kinopoisk: 'Kinopoisk',
    tmdb: 'TMDB',
};

/** Movie and Session headers use the same source priority and read-only global score. */
export default function GlobalMovieRating({ ratings }: { ratings: TMovieDetails['ratings'] }) {
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
    // The source mark stays visual; readers and the tooltip retain the source name and scale.
    return (
        <p className={clsx(ticket.railItem, styles.rating)} title={`${label} rating`}>
            <Icon name="globe" />
            <span className="visually-hidden">{label} rating</span>
            <span className={styles.rating__value}>
                <strong>{formatAverage(rating.value)}</strong>
                <span className="visually-hidden"> out of {rating.scale}</span>
                {rating.voteCount === null ? null : (
                    <small>
                        {voteFormat.format(rating.voteCount)}
                        <span className="visually-hidden"> ratings</span>
                    </small>
                )}
            </span>
        </p>
    );
}
