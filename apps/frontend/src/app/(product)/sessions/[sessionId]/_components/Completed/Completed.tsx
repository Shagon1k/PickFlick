import { type TImportedSelectionOutcome, type TSession } from '@pickflick/contracts';
import Link from 'next/link';

import { formatCount } from '#lib/format';

import NominationRivals from '../NominationRivals/NominationRivals';
import Rating from '../Rating/Rating';
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
            {session.selectionOutcome?.source === 'LIVE' && session.selectionOutcome.breakdown ? (
                <NominationRivals
                    outcome={session.selectionOutcome}
                    breakdown={session.selectionOutcome.breakdown}
                />
            ) : (
                <section className={styles.panel} aria-labelledby="rivals-heading">
                    <h2 id="rivals-heading">Nomination Rivals</h2>
                    {session.selectionOutcome?.source === 'IMPORTED' ? (
                        <ImportedNominations
                            evidence={session.selectionOutcome}
                            movieId={session.movieId}
                        />
                    ) : (
                        <p>{describeMissingRivals(session)}</p>
                    )}
                </section>
            )}
        </div>
    );
}

function ImportedNominations({
    evidence,
    movieId,
}: {
    evidence: TImportedSelectionOutcome;
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
                The list and scores may be incomplete. Original submission times and Selection
                closure are unknown. Recorded totals do not establish a ranking or why this Movie
                was screened.
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
                            {row.author === null
                                ? 'Nominator unknown or hidden.'
                                : `Nominated by ${row.author}`}
                        </p>
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

function describeMissingRivals(session: TSession): string {
    if (session.type === 'PRE_SELECTED') return 'This Movie was pre-selected, without nominations.';
    return session.selectionOutcome
        ? 'Votes are hidden for this Session.'
        : 'No votes were recorded.';
}
