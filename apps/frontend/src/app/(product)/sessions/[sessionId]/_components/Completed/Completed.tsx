import type { TPastSelection, TSelectionOutcome, TSession } from '@pickflick/contracts';
import Link from 'next/link';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import { formatCount, formatUtcDateTime } from '#lib/format';

import Rating from '../Rating/Rating';
import { SELECTION_REASONS } from '../SelectionOutcome/selection-reasons';
import styles from './Completed.module.scss';

export default function Completed({ session }: { session: TSession }) {
    return (
        <div className={styles.grid}>
            {session.rating ? (
                <Rating
                    sessionId={session.id}
                    data={session.rating}
                    isCompleted
                    isImported={session.type === 'PAST'}
                />
            ) : (
                <section className={styles.panel}>
                    <h2>Individual Ratings</h2>
                    <p>No rating record is available for this screening.</p>
                </section>
            )}
            <section className={styles.panel} aria-labelledby="rivals-heading">
                <h2 id="rivals-heading">Nomination Rivals</h2>
                {session.pastSelection ? (
                    <ImportedNominations
                        evidence={session.pastSelection}
                        movieId={session.movieId}
                    />
                ) : (
                    <NominationHistory outcome={session.selectionOutcome} type={session.type} />
                )}
            </section>
        </div>
    );
}

function ImportedNominations({
    evidence,
    movieId,
}: {
    evidence: TPastSelection;
    movieId: string | null;
}) {
    if (evidence.nominations === null)
        return (
            <p>
                Imported nomination and vote evidence is hidden by this Club’s plan or Session
                visibility settings.
            </p>
        );
    if (evidence.nominations.length === 0)
        return (
            <p>
                No nomination or Selection score evidence was imported. The original nominations and
                votes are unknown.
            </p>
        );
    return (
        <>
            <p>
                Imported historical evidence · Scale {evidence.scaleMin}–{evidence.scaleMax}.
            </p>
            <p>
                The list and scores may be incomplete. Nominators, original submission times and
                Selection closure are unknown. Recorded totals do not establish a ranking or why
                this Movie was screened.
            </p>
            <ul className={styles.ranking} aria-label="Imported historical nominations">
                {evidence.nominations.map((row) => (
                    <li key={row.movie.id}>
                        <Link href={`/movies/${row.movie.id}`}>
                            {row.movie.title ?? 'Movie title unavailable'}
                        </Link>
                        {row.movie.id === movieId ? (
                            <span className={styles.winner}>Screened Movie</span>
                        ) : null}
                        <p>
                            {row.total === null
                                ? 'Selection scores unknown.'
                                : `${row.total} recorded total · ${formatCount(row.scoreCount, 'recorded score')}. Other scores are unknown.`}
                        </p>
                    </li>
                ))}
            </ul>
        </>
    );
}

function NominationHistory({
    outcome,
    type,
}: {
    outcome: TSelectionOutcome | null;
    type: TSession['type'];
}) {
    if (!outcome)
        return (
            <p>
                {type === 'PRE_SELECTED'
                    ? 'This Movie was pre-selected. There were no nominations or votes.'
                    : 'No Selection record is available for this screening.'}
            </p>
        );
    return (
        <>
            {outcome.author !== null ? <p>Winner nominated by {outcome.author}</p> : null}
            <p>
                Selection closed {formatUtcDateTime(outcome.closedAt)} ·{' '}
                {outcome.closure === 'MANUAL' ? 'by a Club operator' : 'automatically'}
            </p>
            <HistoricalVotes breakdown={outcome.breakdown} />
        </>
    );
}

function HistoricalVotes({ breakdown }: { breakdown: TSelectionOutcome['breakdown'] }) {
    if (!breakdown)
        return (
            <p>Vote breakdowns are hidden by this Club’s plan or Session visibility settings.</p>
        );
    return (
        <>
            <p>
                {formatCount(breakdown.ballotCount, 'ballot')} received · Scale {breakdown.scaleMin}
                –{breakdown.scaleMax}.
            </p>
            <p>{SELECTION_REASONS[breakdown.reason]}.</p>
            {breakdown.ballotCount === 0 ? <p>No ballots were received.</p> : null}
            <ol className={styles.ranking} aria-label="Historical nominations">
                {breakdown.ranking.map((row, index) => (
                    <li key={row.id}>
                        <div className={styles.nominee}>
                            <SearchPoster
                                className={styles.poster}
                                url={`/api/movies/${row.movie.id}/poster`}
                            />
                            <div>
                                <Link href={`/movies/${row.movie.id}`}>
                                    {row.movie.title ?? 'Movie title unavailable'}
                                </Link>
                                {index === 0 ? <span className={styles.winner}>Winner</span> : null}
                                {row.author !== null ? <p>Nominated by {row.author}</p> : null}
                                <p>
                                    {[row.movie.year, ...row.movie.genres]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </div>
                        </div>
                        <details>
                            <summary>{row.total} total · Vote breakdown</summary>
                            <dl>
                                <div>
                                    <dt>Top-score votes</dt>
                                    <dd>{row.maximumCount}</dd>
                                </div>
                                <div>
                                    <dt>Supporters</dt>
                                    <dd>{row.supporterCount}</dd>
                                </div>
                            </dl>
                        </details>
                    </li>
                ))}
            </ol>
            {breakdown.ranking.length === 1 ? <p>No rival nominations.</p> : null}
        </>
    );
}
