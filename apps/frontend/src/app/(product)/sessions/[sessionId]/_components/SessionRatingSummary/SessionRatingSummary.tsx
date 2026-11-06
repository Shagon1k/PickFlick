import {
    formatRatingScore,
    RATING_SCALE,
    type TMovieDetails,
    type TRating,
} from '@pickflick/contracts';
import clsx from 'clsx';

import ticket from '#components/movies/film-ticket.module.scss';
import GlobalMovieRating from '#components/movies/GlobalMovieRating/GlobalMovieRating';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import { formatAverage } from '#lib/format';

import styles from './SessionRatingSummary.module.scss';

/** These cells describe historical Session results; none edits a Personal Rating. */
export default function SessionRatingSummary({
    rating,
    movieRatings,
}: {
    rating: TRating | null;
    movieRatings: TMovieDetails['ratings'];
}) {
    return (
        <>
            <ScoreCell label="Club" icon="ratings" value={rating?.results?.average ?? null} />
            <ScoreCell label="You" icon="profile" value={rating?.own?.score ?? null} />
            <GlobalMovieRating ratings={movieRatings} />
        </>
    );
}

function ScoreCell({
    label,
    icon,
    value,
}: {
    label: 'Club' | 'You';
    icon: TIconName;
    value: number | null;
}) {
    let score = '—';
    if (value !== null) score = label === 'You' ? formatRatingScore(value) : formatAverage(value);
    return (
        <p className={clsx(ticket.railItem, styles.cell)}>
            <Icon name={icon} />
            <span className={styles.cell__value}>
                <strong aria-hidden={value === null || undefined}>{score}</strong>
                <span className="visually-hidden">
                    {value === null ? 'Not available ' : ` out of ${RATING_SCALE.max} `}
                </span>
                <small>{label}</small>
            </span>
        </p>
    );
}
