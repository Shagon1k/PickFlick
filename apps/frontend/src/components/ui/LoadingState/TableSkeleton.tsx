import type { ReactNode } from 'react';

import Skeleton from '#components/ui/Skeleton/Skeleton';
import Table from '#components/ui/Table/Table';

import styles from './TableSkeleton.module.scss';

const ROW_COUNT = 4;

export default function TableSkeleton({
    variant,
}: {
    variant: 'club-ratings' | 'ratings' | 'watchlist';
}) {
    const isClub = variant === 'club-ratings';
    const columns = [
        { key: 'rank', header: '#', isNumeric: true },
        { key: 'film', header: 'Film' },
        ...(!isClub ? [{ key: 'genre', header: 'Genre' }] : []),
        { key: 'year', header: 'Year' },
        ...(isClub
            ? [{ key: 'genre', header: 'Genre' }]
            : [{ key: 'date', header: variant === 'watchlist' ? 'Added on' : 'Rated on' }]),
        {
            key: 'value',
            header: variant === 'watchlist' ? 'Priority' : 'Rating',
            isNumeric: isClub,
        },
    ];
    return (
        <div className={styles.layout}>
            <div className={styles.search}>
                <Skeleton variant="control" shouldFill />
            </div>
            {!isClub ? (
                <div className={styles.count}>
                    <Skeleton shouldFill />
                </div>
            ) : null}
            <Table
                variant="leaderboard"
                caption="Loading films"
                columns={columns}
                rows={Array.from({ length: ROW_COUNT }, (_, index) => ({
                    id: String(index),
                    cells: Object.fromEntries(
                        columns.map(({ key }): [string, ReactNode] => [
                            key,
                            <div
                                className={styles.cell}
                                data-film={key === 'film' || undefined}
                                data-club={isClub || undefined}
                                key={key}
                            >
                                <Skeleton
                                    variant={key === 'value' ? 'title' : 'text'}
                                    width={key === 'film' ? 'half' : 'full'}
                                />
                            </div>,
                        ]),
                    ),
                }))}
            />
            <div className={styles.pagination}>
                <div className={styles.arrow}>
                    <Skeleton shouldFill />
                </div>
                <div className={styles.page}>
                    <Skeleton />
                </div>
                <div className={styles.arrow}>
                    <Skeleton shouldFill />
                </div>
            </div>
        </div>
    );
}
