import type { TSelectionOutcome, TSelectionReason } from '@pickflick/contracts';
import Link from 'next/link';

import { formatUtcDateTime } from '#lib/format';

import styles from './SelectionOutcome.module.scss';

const REASONS: Record<TSelectionReason, string> = {
    TOTAL: 'Highest total score',
    MAXIMUM_COUNT: 'Tie resolved by more maximum scores',
    SUPPORTER_COUNT: 'Tie resolved by more supporting voters',
    NOMINATION_TIME: 'Tie resolved by earlier nomination',
    PROVIDER_ID: 'Tie resolved by lower Movie provider ID',
    NOMINATION_ID: 'Tie resolved by lower nomination ID',
    ONLY_NOMINATION: 'Only eligible nomination',
};

interface ISelectionOutcomeProps {
    data: TSelectionOutcome;
}

export default function SelectionOutcome({ data }: ISelectionOutcomeProps) {
    return (
        <section className={styles.outcome} aria-labelledby="selection-result-heading">
            <div className={styles.winner}>
                <p className={styles.eyebrow}>Selection complete</p>
                <h2 id="selection-result-heading">Tonight’s pick</h2>
                <h3>
                    <Link href={`/movies/${data.winner.id}`}>
                        {data.winner.title ?? 'Movie title unavailable'}
                    </Link>
                </h3>
                {data.winner.year ? <p>{data.winner.year}</p> : null}
                {data.author !== null ? <p>Nominated by {data.author}</p> : null}
                <p>
                    {data.closure === 'MANUAL'
                        ? 'Closed by a Club operator'
                        : 'All accepted participants submitted'}{' '}
                    · {formatUtcDateTime(data.closedAt)}
                </p>
            </div>
            {data.breakdown ? (
                <>
                    <h3>Selection results</h3>
                    <p>
                        {data.breakdown.ballotCount} ballots received · Scale{' '}
                        {data.breakdown.scaleMin}–{data.breakdown.scaleMax}.
                    </p>
                    <p>{REASONS[data.breakdown.reason]}.</p>
                    {data.breakdown.ballotCount === 0 ? (
                        <p>
                            No ballots were received. All totals are zero; the tie-break rules chose
                            the winner.
                        </p>
                    ) : null}
                    <ol className={styles.ranking} aria-label="Selection ranking">
                        {data.breakdown.ranking.map((row) => (
                            <li key={row.id}>
                                <div>
                                    <Link href={`/movies/${row.movie.id}`}>
                                        {row.movie.title ?? 'Movie title unavailable'}
                                    </Link>
                                    {row.author !== null ? <p>Nominated by {row.author}</p> : null}
                                </div>
                                <dl>
                                    <div>
                                        <dt>Total score</dt>
                                        <dd>{row.total}</dd>
                                    </div>
                                    <div>
                                        <dt>Maximum scores</dt>
                                        <dd>{row.maximumCount}</dd>
                                    </div>
                                    <div>
                                        <dt>Supporting voters</dt>
                                        <dd>{row.supporterCount}</dd>
                                    </div>
                                </dl>
                            </li>
                        ))}
                    </ol>
                </>
            ) : (
                <p>
                    Vote breakdowns are hidden by this Club’s plan or Session visibility settings.
                </p>
            )}
        </section>
    );
}
