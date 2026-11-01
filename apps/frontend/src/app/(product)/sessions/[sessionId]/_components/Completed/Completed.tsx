import type { TSession } from '@pickflick/contracts';

import ImportedNominations from '../NominationRivals/ImportedNominations';
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
            <SessionRivals session={session} />
        </div>
    );
}

function SessionRivals({ session }: { session: TSession }) {
    if (session.selectionOutcome?.source === 'LIVE' && session.selectionOutcome.breakdown) {
        return (
            <NominationRivals
                outcome={session.selectionOutcome}
                breakdown={session.selectionOutcome.breakdown}
            />
        );
    }
    if (session.selectionOutcome?.source === 'IMPORTED') {
        return (
            <ImportedNominations evidence={session.selectionOutcome} movieId={session.movieId} />
        );
    }
    return (
        <section className={styles.panel} aria-labelledby="rivals-heading">
            <h2 id="rivals-heading">Nomination Rivals</h2>
            <p>{describeMissingRivals(session)}</p>
        </section>
    );
}

function describeMissingRivals(session: TSession): string {
    if (session.type === 'PRE_SELECTED') return 'This Movie was pre-selected, without nominations.';
    return session.selectionOutcome
        ? 'Votes are hidden for this Session.'
        : 'No votes were recorded.';
}
