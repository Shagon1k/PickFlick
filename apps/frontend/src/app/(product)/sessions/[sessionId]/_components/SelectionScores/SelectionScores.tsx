import type { TSelectionScores } from '@pickflick/contracts';

import Table from '#components/ui/Table/Table';

import styles from './SelectionScores.module.scss';

export default function SelectionScores({ data }: { data: TSelectionScores }) {
    return (
        <section aria-label="Selection scores" className={styles.scores}>
            <Table
                caption={`Selection scores · Scale ${data.scaleMin}–${data.scaleMax}`}
                columns={[
                    { key: 'participant', header: 'Participant' },
                    ...data.films.map((film) => ({
                        key: film.nominationId,
                        header: film.movie.title ?? 'Movie title unavailable',
                        isNumeric: true,
                    })),
                ]}
                rows={data.ballots.map((ballot) => {
                    const scores = new Map(
                        ballot.scores.map(({ nominationId, score }) => [nominationId, score]),
                    );
                    return {
                        id: ballot.participantId,
                        cells: {
                            participant: ballot.author,
                            ...Object.fromEntries(
                                data.films.map(({ nominationId }) => [
                                    nominationId,
                                    scores.get(nominationId) ?? '—',
                                ]),
                            ),
                        },
                    };
                })}
                emptyMessage="No Selection scores were recorded."
            />
        </section>
    );
}
