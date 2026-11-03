import type { TImportedSelectionOutcome } from '@pickflick/contracts';

import NominationMovieCard from '#components/sessions/NominationMovieCard/NominationMovieCard';
import NominationMovieList from '#components/sessions/NominationMovieList/NominationMovieList';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import { formatCount } from '#lib/format';

import styles from './NominationRivals.module.scss';

/** Partial recorded totals never imply a complete ballot, ranking or computed winner. */
export default function ImportedNominations({
    evidence,
    movieId,
}: {
    evidence: TImportedSelectionOutcome;
    movieId: string | null;
}) {
    const hasDifferentScoreCounts =
        new Set(evidence.nominations?.map((row) => row.scoreCount)).size > 1;
    return (
        <section className={styles.rivals} aria-labelledby="rivals-heading">
            <div className={styles.header}>
                <h2 id="rivals-heading">Nomination Rivals</h2>
            </div>
            {evidence.nominations === null ? <p>Votes are hidden for this Session.</p> : null}
            {evidence.nominations?.length === 0 ? <p>No votes were recorded.</p> : null}
            {evidence.nominations?.length ? (
                <NominationMovieList label="Logged nominations">
                    {evidence.nominations.map((row) => (
                        <li key={row.movie.id}>
                            <NominationMovieCard
                                movie={row.movie}
                                author={row.author}
                                badge={row.movie.id === movieId ? 'Watched' : undefined}
                                score={
                                    <div className={styles.recordedScore}>
                                        <strong>
                                            <ColorReveal variant="accent">
                                                {row.total ?? '—'}
                                            </ColorReveal>
                                        </strong>
                                        <small>
                                            total
                                            <span
                                                className={
                                                    hasDifferentScoreCounts
                                                        ? undefined
                                                        : 'visually-hidden'
                                                }
                                            >
                                                {' · '}
                                                {formatCount(row.scoreCount, 'score')}
                                            </span>
                                        </small>
                                    </div>
                                }
                            />
                        </li>
                    ))}
                </NominationMovieList>
            ) : null}
        </section>
    );
}
