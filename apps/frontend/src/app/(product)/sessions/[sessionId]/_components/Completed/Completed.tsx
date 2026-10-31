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
                <Rating sessionId={session.id} data={session.rating} isCompleted />
            ) : (
                <section className={styles.panel}>
                    <h2>Ratings</h2>
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

/** A logged Session shows only what was recorded; the header's LOGGED note covers the rest. */
function ImportedNominations({
    evidence,
    movieId,
}: {
    evidence: TImportedSelectionOutcome;
    movieId: string | null;
}) {
    if (evidence.nominations === null) return <p>Votes are hidden for this Session.</p>;
    if (evidence.nominations.length === 0) return <p>No votes were recorded.</p>;
    return (
        <ul className={styles.ranking} aria-label="Logged nominations">
            {evidence.nominations.map((row) => (
                <li key={row.movie.id}>
                    <Link href={`/movies/${row.movie.id}`}>
                        {row.movie.title ?? 'Movie title unavailable'}
                    </Link>
                    {row.movie.id === movieId ? (
                        <span className={styles.winner}>Screened Movie</span>
                    ) : null}
                    {row.author === null ? null : <p>Nominated by {row.author}</p>}
                    {row.total === null ? null : (
                        <p>
                            {row.total} total · {formatCount(row.scoreCount, 'score')}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    );
}

function describeMissingRivals(session: TSession): string {
    if (session.type === 'PRE_SELECTED') return 'This Movie was pre-selected, without nominations.';
    return session.selectionOutcome
        ? 'Votes are hidden for this Session.'
        : 'No votes were recorded.';
}
