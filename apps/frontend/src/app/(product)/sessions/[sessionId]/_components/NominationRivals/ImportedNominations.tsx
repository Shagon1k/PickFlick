import type { TImportedSelectionOutcome } from '@pickflick/contracts';

import { formatCount } from '#lib/format';

import styles from './NominationRivals.module.scss';
import RivalCard from './RivalCard';

/** Partial recorded totals never imply a complete ballot, ranking or computed winner. */
export default function ImportedNominations({
    evidence,
    movieId,
}: {
    evidence: TImportedSelectionOutcome;
    movieId: string | null;
}) {
    return (
        <section className={styles.rivals} aria-labelledby="rivals-heading">
            <div className={styles.header}>
                <h3 id="rivals-heading">Nomination Rivals</h3>
            </div>
            {evidence.nominations === null ? <p>Votes are hidden for this Session.</p> : null}
            {evidence.nominations?.length === 0 ? <p>No votes were recorded.</p> : null}
            {evidence.nominations?.length ? (
                <ul className={styles.list} aria-label="Logged nominations">
                    {evidence.nominations.map((row) => (
                        <RivalCard
                            key={row.movie.id}
                            movie={row.movie}
                            author={row.author}
                            badge={row.movie.id === movieId ? 'Screened Movie' : undefined}
                        >
                            <div className={styles.recordedScore}>
                                <strong>{row.total ?? '—'}</strong>
                                <small>total · {formatCount(row.scoreCount, 'score')}</small>
                            </div>
                        </RivalCard>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}
