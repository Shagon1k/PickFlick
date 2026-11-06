'use client';

import type { TSelectionScores } from '@pickflick/contracts';
import { useId, useState } from 'react';

import Table from '#components/ui/Table/Table';
import { formatMovieTitle } from '#lib/format';
import { getNextTableSort } from '#lib/table-sort';

import styles from './SelectionScores.module.scss';

export default function SelectionScores({ data }: { data: TSelectionScores }) {
    const headingId = useId();
    const [sorting, setSorting] = useState<{ sort: string; direction?: 'asc' | 'desc' }>({
        sort: 'participant',
    });
    const rows = data.ballots.map((ballot) => ({
        id: ballot.participantId,
        author: ballot.author,
        scores: new Map(ballot.scores.map(({ nominationId, score }) => [nominationId, score])),
    }));
    const direction = sorting.direction === 'desc' ? -1 : 1;
    const sorted = sorting.direction
        ? rows.toSorted((left, right) => {
              if (sorting.sort === 'participant')
                  return direction * left.author.localeCompare(right.author);
              const leftScore = left.scores.get(sorting.sort);
              const rightScore = right.scores.get(sorting.sort);
              if (leftScore === undefined) return rightScore === undefined ? 0 : 1;
              if (rightScore === undefined) return -1;
              return direction * (leftScore - rightScore);
          })
        : rows;
    function sortable(column: string) {
        return {
            sortDirection: sorting.sort === column ? sorting.direction : undefined,
            onSort: () => setSorting(getNextTableSort(sorting, column) ?? { sort: 'participant' }),
        };
    }
    return (
        <section aria-labelledby={headingId} className={styles.scores}>
            <header className={styles.header}>
                <h2 id={headingId}>Selection scores</h2>
                <span>
                    Scale {data.scaleMin}–{data.scaleMax}
                </span>
            </header>
            <Table
                variant="matrix"
                caption={`Selection scores · Scale ${data.scaleMin}–${data.scaleMax}`}
                columns={[
                    { key: 'participant', header: 'Participant', ...sortable('participant') },
                    ...data.films.map((film) => ({
                        key: film.nominationId,
                        header: (
                            <span className={styles.filmTitle}>{formatMovieTitle(film.movie)}</span>
                        ),
                        isNumeric: true,
                        ...sortable(film.nominationId),
                    })),
                ]}
                rows={sorted.map((row) => ({
                    id: row.id,
                    cells: {
                        participant: row.author,
                        ...Object.fromEntries(
                            data.films.map(({ nominationId }) => [
                                nominationId,
                                row.scores.get(nominationId) ?? '—',
                            ]),
                        ),
                    },
                }))}
                emptyMessage="No Selection scores were recorded."
            />
        </section>
    );
}
