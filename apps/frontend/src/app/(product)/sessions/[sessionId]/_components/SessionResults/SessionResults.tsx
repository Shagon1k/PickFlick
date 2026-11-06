import type { TSession } from '@pickflick/contracts';
import clsx from 'clsx';

import page from '../../page.module.scss';
import ImportedNominations from '../NominationRivals/ImportedNominations';
import NominationAuthors from '../NominationRivals/NominationAuthors';
import NominationRivals from '../NominationRivals/NominationRivals';
import Rating from '../Rating/Rating';
import SelectionScores from '../SelectionScores/SelectionScores';
import styles from './SessionResults.module.scss';

export default function SessionResults({
    session,
    isLoading = false,
}: {
    session: TSession;
    isLoading?: boolean;
}) {
    return (
        <>
            <div className={styles.grid}>
                {session.rating ? (
                    <Rating
                        data={session.rating}
                        isInProgress={session.phase === 'RATING'}
                        isLoading={isLoading}
                    />
                ) : (
                    <section className={clsx(page.panel, styles.panel)}>
                        <h2>Ratings</h2>
                        <p>No rating record is available for this screening.</p>
                    </section>
                )}
                <SessionRivals session={session} isLoading={isLoading} />
            </div>
            {session.selectionScores ? <SelectionScores data={session.selectionScores} /> : null}
        </>
    );
}

function SessionRivals({ session, isLoading }: { session: TSession; isLoading: boolean }) {
    if (session.selectionOutcome?.source === 'LIVE' && session.selectionOutcome.breakdown) {
        return (
            <NominationRivals
                outcome={session.selectionOutcome}
                breakdown={session.selectionOutcome.breakdown}
                isLoading={isLoading}
            />
        );
    }
    if (session.selectionOutcome?.source === 'IMPORTED') {
        if (session.selectionOutcome.nominations === null && session.nominationAuthors)
            return <NominationAuthors authors={session.nominationAuthors} isLoading={isLoading} />;
        return (
            <ImportedNominations
                evidence={session.selectionOutcome}
                movieId={session.movieId}
                isLoading={isLoading}
            />
        );
    }
    if (session.nominationAuthors)
        return <NominationAuthors authors={session.nominationAuthors} isLoading={isLoading} />;
    return (
        <section className={clsx(page.panel, styles.panel)} aria-labelledby="rivals-heading">
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
