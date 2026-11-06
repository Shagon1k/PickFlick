import type { ReactNode } from 'react';

import { getFilmTableColumns, type TFilmTableVariant } from '#components/movies/film-table-columns';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import Table, { type ITableRow } from '#components/ui/Table/Table';

import styles from './FilmTableSkeleton.module.scss';

const ROW_COUNT = 4;

export function buildFilmTableSkeletonRows(
    variant: TFilmTableVariant,
    rowCount = ROW_COUNT,
): ITableRow[] {
    const isClub = variant === 'club-ratings';
    const isWatchlist = variant === 'watchlist';
    const columns = getFilmTableColumns(variant);
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

export default function FilmTableSkeleton({ variant }: { variant: TFilmTableVariant }) {
    return (
        <div className={styles.layout}>
            <div className={styles.search}>
                <Skeleton variant="control" shouldFill />
            </div>
            <Table
                variant="leaderboard"
                caption="Loading films"
                columns={getFilmTableColumns(variant)}
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
