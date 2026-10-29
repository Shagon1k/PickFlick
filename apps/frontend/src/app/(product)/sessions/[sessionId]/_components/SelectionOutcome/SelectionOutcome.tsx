import type { TLiveSelectionOutcome } from '@pickflick/contracts';
import Link from 'next/link';

import { formatUtcDateTime } from '#lib/format';

import styles from './SelectionOutcome.module.scss';
import SelectionSummary, { HIDDEN_BREAKDOWN_COPY } from './SelectionSummary';

interface ISelectionOutcomeProps {
    data: TLiveSelectionOutcome;
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
                    <SelectionSummary breakdown={data.breakdown} />
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
                                        <dt>Top-score votes</dt>
                                        <dd>{row.maximumCount}</dd>
                                    </div>
                                    <div>
                                        <dt>Supporters</dt>
                                        <dd>{row.supporterCount}</dd>
                                    </div>
                                </dl>
                            </li>
                        ))}
                    </ol>
                </>
            ) : (
                <p>{HIDDEN_BREAKDOWN_COPY}</p>
            )}
        </section>
    );
}
