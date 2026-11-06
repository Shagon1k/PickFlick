'use client';

import { type TLiveSelectionOutcome, type TSelectionReason } from '@pickflick/contracts';
import { useId, useState } from 'react';

import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import LocalTime from '#components/ui/LocalTime/LocalTime';
import Popover from '#components/ui/Popover/Popover';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatAverage, formatCount, formatMovieTitle } from '#lib/format';

import NominationMovieCard from '../NominationMovieCard/NominationMovieCard';
import NominationMovieList from '../NominationMovieList/NominationMovieList';
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
    isLoading = false,
}: {
    outcome: TLiveSelectionOutcome;
    breakdown: TBreakdown;
    isLoading?: boolean;
}) {
    const average = (rival: TRival) =>
        breakdown.ballotCount ? rival.total / breakdown.ballotCount : 0;
    const [winner] = breakdown.ranking;
    return (
        <section aria-labelledby="rivals-heading" className={styles.rivals}>
            <div className={styles.header}>
                <h2 id="rivals-heading">Nomination Rivals</h2>
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
            <NominationMovieList label="Selection ranking" ordered>
                {breakdown.ranking.map((rival, index) => (
                    <li key={rival.id}>
                        <NominationMovieCard
                            movie={rival.movie}
                            author={rival.author}
                            badge={index === 0 ? 'Winner' : undefined}
                            isLoading={isLoading}
                            score={
                                <RivalScore
                                    rival={rival}
                                    average={average(rival)}
                                    isLoading={isLoading}
                                />
                            }
                        />
                    </li>
                ))}
            </NominationMovieList>
        </section>
    );
}

function RivalScore({
    rival,
    average,
    isLoading,
}: {
    rival: TRival;
    average: number;
    isLoading: boolean;
}) {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    const title = formatMovieTitle(rival.movie);
    return (
        <Popover
            id={id}
            label={`Selection details for ${title}`}
            open={isOpen}
            onChange={setIsOpen}
            variant="selection"
            trigger={
                <button
                    aria-label={`Average Selection score ${formatAverage(average)} for ${title}. Show details`}
                    className={styles.score}
                    disabled={isLoading}
                    data-open={isOpen || undefined}
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    <strong>
                        {isLoading ? (
                            <Skeleton text={formatAverage(average)} />
                        ) : (
                            <ColorReveal variant="accent">{formatAverage(average)}</ColorReveal>
                        )}
                    </strong>
                    <span className={styles.scoreHint}>
                        <small>avg.</small>
                        <Icon name="chevron-down" />
                    </span>
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
