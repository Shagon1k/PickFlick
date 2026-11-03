import type { TSessionNominationAuthors } from '@pickflick/contracts';

import NominationMovieCard from '#components/sessions/NominationMovieCard/NominationMovieCard';
import NominationMovieList from '#components/sessions/NominationMovieList/NominationMovieList';

import styles from './NominationRivals.module.scss';

/** Author visibility is independent from the Selection score breakdown. */
export default function NominationAuthors({
    authors,
    isLoading = false,
}: {
    authors: TSessionNominationAuthors;
    isLoading?: boolean;
}) {
    return (
        <section aria-labelledby="rivals-heading" className={styles.rivals}>
            <div className={styles.header}>
                <h2 id="rivals-heading">Nomination Rivals</h2>
            </div>
            {authors.length ? (
                <NominationMovieList label="Nominated films">
                    {authors.map((row) => (
                        <li key={row.nominationId}>
                            <NominationMovieCard
                                movie={row.movie}
                                author={row.author}
                                isLoading={isLoading}
                            />
                        </li>
                    ))}
                </NominationMovieList>
            ) : (
                <p>No nominations were recorded.</p>
            )}
        </section>
    );
}
