'use client';

import {
    getPosterPath,
    type TLiveSelectionOutcome,
    type TSelectionReason,
} from '@pickflick/contracts';
import Link from 'next/link';
import { useId, useState } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import LocalTime from '#components/ui/LocalTime/LocalTime';
import Popover from '#components/ui/Popover/Popover';
import { formatAverage, formatCount } from '#lib/format';

import styles from './NominationRivals.module.scss';

type TBreakdown = NonNullable<TLiveSelectionOutcome['breakdown']>;
type TRival = TBreakdown['ranking'][number];

const SELECTION_REASONS: Record<TSelectionReason, string> = {
    TOTAL: 'Highest total score',
    MAXIMUM_COUNT: 'Tie resolved by more top scores',
    SUPPORTER_COUNT: 'Tie resolved by more supporters',
    NOMINATION_TIME: 'Tie resolved by earlier nomination',
    PROVIDER_ID: 'Tie resolved by lower Movie provider ID',
    NOMINATION_ID: 'Tie resolved by lower nomination ID',
    ONLY_NOMINATION: 'Only eligible nomination',
};

/** The prototype's Nomination Rivals card: every nominee with its average vote, winner first. */
export default function NominationRivals({
    outcome,
    breakdown,
}: {
    outcome: TLiveSelectionOutcome;
    breakdown: TBreakdown;
}) {
    const average = (rival: TRival) =>
        breakdown.ballotCount ? rival.total / breakdown.ballotCount : 0;
    const [winner] = breakdown.ranking;
    return (
        <section aria-labelledby="rivals-heading" className={styles.rivals}>
            <div className={styles.header}>
                <h3 id="rivals-heading">Nomination Rivals</h3>
                {winner ? (
                    <span className={styles.note}>winner: {formatAverage(average(winner))}</span>
                ) : null}
                <InfoTip label="About this Selection">
                    Closed <LocalTime value={outcome.closedAt} />{' '}
                    {outcome.closure === 'MANUAL' ? 'by a Club operator' : 'automatically'}.{' '}
                    {formatCount(breakdown.ballotCount, 'ballot')} on a {breakdown.scaleMin}–
                    {breakdown.scaleMax} scale. {SELECTION_REASONS[breakdown.reason]}.
                </InfoTip>
            </div>
            <ol className={styles.list}>
                {breakdown.ranking.map((rival, index) => (
                    <li className={styles.card} key={rival.id}>
                        <SearchPoster
                            className={styles.poster}
                            url={getPosterPath(rival.movie.id)}
                        />
                        <div className={styles.info}>
                            <h4>
                                <Link href={`/movies/${rival.movie.id}`}>
                                    {rival.movie.title ?? 'Movie title unavailable'}
                                </Link>
                                {index === 0 ? <span className={styles.winner}>Winner</span> : null}
                            </h4>
                            {rival.author !== null ? (
                                <span className={styles.meta}>by {rival.author}</span>
                            ) : null}
                            {rival.movie.genres.length ? (
                                <ul className={styles.genres} aria-label="Genres">
                                    {rival.movie.genres.map((genre) => (
                                        <li key={genre}>{genre}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                        <RivalScore rival={rival} average={average(rival)} />
                    </li>
                ))}
            </ol>
        </section>
    );
}

function RivalScore({ rival, average }: { rival: TRival; average: number }) {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    const title = rival.movie.title ?? 'this Movie';
    return (
        <Popover
            id={id}
            label={`Votes for ${title}`}
            open={isOpen}
            onChange={setIsOpen}
            variant="watchlist"
            trigger={
                <button
                    aria-label={`Average vote ${formatAverage(average)} for ${title}. Show votes`}
                    className={styles.score}
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    <strong>{formatAverage(average)}</strong>
                    <small>avg. vote</small>
                </button>
            }
        >
            <dl className={styles.votes}>
                <div>
                    <dt>Total</dt>
                    <dd>{rival.total}</dd>
                </div>
                <div>
                    <dt>Top scores</dt>
                    <dd>{rival.maximumCount}</dd>
                </div>
                <div>
                    <dt>Supporters</dt>
                    <dd>{rival.supporterCount}</dd>
                </div>
            </dl>
        </Popover>
    );
}
