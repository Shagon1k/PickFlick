import type { ReactNode } from 'react';

import Skeleton from '#components/ui/Skeleton/Skeleton';
import Table, { type ITableRow } from '#components/ui/Table/Table';

import styles from './FilmTableSkeleton.module.scss';

const ROW_COUNT = 4;
type TFilmTableSkeletonVariant = 'club-ratings' | 'ratings' | 'watchlist';

function buildColumns(variant: TFilmTableSkeletonVariant) {
    const rank = { key: 'rank', header: '#', isNumeric: true };
    const film = { key: 'film', header: 'Film' };
    const genre = { key: 'genre', header: 'Genre' };
    const year = { key: 'year', header: 'Year' };
    if (variant === 'club-ratings')
        return [rank, film, year, genre, { key: 'value', header: 'Rating', isNumeric: true }];
    const isWatchlist = variant === 'watchlist';
    return [
        rank,
        film,
        genre,
        year,
        { key: 'date', header: isWatchlist ? 'Added on' : 'Rated on' },
        { key: 'value', header: isWatchlist ? 'Priority' : 'Rating', isNumeric: !isWatchlist },
    ];
}

export function buildFilmTableSkeletonRows(
    variant: TFilmTableSkeletonVariant,
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

export default function FilmTableSkeleton({ variant }: { variant: TFilmTableSkeletonVariant }) {
    return (
        <div className={styles.layout}>
            <div className={styles.search}>
                <Skeleton variant="control" shouldFill />
            </div>
            <Table
                variant="leaderboard"
                caption="Loading films"
                columns={buildColumns(variant)}
                rows={buildFilmTableSkeletonRows(variant)}
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
