import type { TImportedSelectionOutcome } from '@pickflick/contracts';

import NominationMovieCard from '#components/sessions/NominationMovieCard/NominationMovieCard';
import NominationMovieList from '#components/sessions/NominationMovieList/NominationMovieList';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatCount } from '#lib/format';

import styles from './NominationRivals.module.scss';

/** Partial recorded totals never imply a complete ballot, ranking or computed winner. */
export default function ImportedNominations({
    evidence,
    movieId,
    isLoading = false,
}: {
    evidence: TImportedSelectionOutcome;
    movieId: string | null;
    isLoading?: boolean;
}) {
    return (
        <section className={styles.rivals} aria-labelledby="rivals-heading">
            <div className={styles.header}>
                <h2 id="rivals-heading">Nomination Rivals</h2>
            </div>
            <LoggedNominations
                nominations={evidence.nominations}
                movieId={movieId}
                isLoading={isLoading}
            />
        </section>
    );
}

function LoggedNominations({
    nominations,
    movieId,
    isLoading,
}: {
    nominations: TImportedSelectionOutcome['nominations'];
    movieId: string | null;
    isLoading: boolean;
}) {
    if (nominations === null) return <p>Votes are hidden for this Session.</p>;
    if (!nominations.length) return <p>No votes were recorded.</p>;
    const hasDifferentScoreCounts = new Set(nominations.map((row) => row.scoreCount)).size > 1;
    return (
        <NominationMovieList label="Logged nominations">
            {nominations.map((row) => (
                <li key={row.movie.id}>
                    <NominationMovieCard
                        movie={row.movie}
                        author={row.author}
                        badge={row.movie.id === movieId ? 'Watched' : undefined}
                        isLoading={isLoading}
                        score={
                            <div className={styles.recordedScore}>
                                <strong>
                                    {isLoading ? (
                                        <Skeleton text={row.total ?? '—'} />
                                    ) : (
                                        <ColorReveal variant="accent">
                                            {row.total ?? '—'}
                                        </ColorReveal>
                                    )}
                                </strong>
                                <small>
                                    total
                                    <span
                                        className={
                                            hasDifferentScoreCounts ? undefined : 'visually-hidden'
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
    );
}
