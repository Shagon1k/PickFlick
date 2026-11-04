import type { ReactNode } from 'react';

import Skeleton from '#components/ui/Skeleton/Skeleton';
import Table, { type ITableRow } from '#components/ui/Table/Table';

import styles from './TableSkeleton.module.scss';

const ROW_COUNT = 4;
type TTableSkeletonVariant = 'club-ratings' | 'ratings' | 'watchlist';

function buildColumns(variant: TTableSkeletonVariant) {
    const isClub = variant === 'club-ratings';
    const isWatchlist = variant === 'watchlist';
    return [
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
            isNumeric: !isWatchlist,
        },
    ];
}

export function buildTableSkeletonRows(
    variant: TTableSkeletonVariant,
    rowCount = ROW_COUNT,
): ITableRow[] {
    const isClub = variant === 'club-ratings';
    const isWatchlist = variant === 'watchlist';
    const columns = buildColumns(variant);
    return Array.from({ length: rowCount }, (_, index) => ({
        id: String(index),
        cells: Object.fromEntries(
            columns.map(({ key }): [string, ReactNode] => [
                key,
                <div
                    className={styles.cell}
                    data-film={key === 'film' || undefined}
                    data-numeric={(key === 'value' && !isWatchlist) || undefined}
                    key={key}
                >
                    {key === 'value' && !isClub ? (
                        <div className={styles.control} data-priority={isWatchlist || undefined}>
                            <Skeleton shouldFill />
                        </div>
                    ) : (
                        <Skeleton
                            variant={key === 'value' ? 'title' : 'text'}
                            width={key === 'film' ? 'half' : 'full'}
                        />
                    )}
                </div>,
            ]),
        ),
    }));
}

export default function TableSkeleton({ variant }: { variant: TTableSkeletonVariant }) {
    return (
        <div className={styles.layout}>
            <div className={styles.search}>
                <Skeleton variant="control" shouldFill />
            </div>
            <Table
                variant="leaderboard"
                caption="Loading films"
                columns={buildColumns(variant)}
                rows={buildTableSkeletonRows(variant)}
                isLoading
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
