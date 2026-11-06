'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

import HorizontalScroll from '#components/ui/HorizontalScroll/HorizontalScroll';
import Icon from '#components/ui/Icon/Icon';

import styles from './Table.module.scss';

export interface ITableColumn {
    key: string;
    header: ReactNode;
    isNumeric?: boolean;
    sortDirection?: 'asc' | 'desc';
    onSort?: () => void;
    isSortDisabled?: boolean;
}

export interface ITableRow {
    id: string;
    cells: Record<string, ReactNode>;
}

export interface ITableProps {
    caption: string;
    columns: ITableColumn[];
    rows: ITableRow[];
    emptyMessage?: string;
    variant?: 'default' | 'leaderboard' | 'matrix';
    isLoading?: boolean;
}

function getAriaSort(direction?: 'asc' | 'desc') {
    if (direction === 'asc') return 'ascending';
    if (direction === 'desc') return 'descending';
    return undefined;
}

function getSortLabel(direction: 'asc' | 'desc' | undefined, hasExplicitSort: boolean) {
    if (direction === 'asc') return ': sort descending';
    if (hasExplicitSort) return ': reset sorting';
    return ': sort ascending';
}

/** A semantic table whose dense content scrolls inside its own region, never the page. */
export default function Table({
    caption,
    columns,
    emptyMessage = 'No records yet.',
    rows,
    variant = 'default',
    isLoading = false,
}: ITableProps) {
    const getCellClass = (column: ITableColumn) =>
        column.isNumeric ? styles.table__numeric : undefined;
    const hasExplicitSort = columns.some((column) => column.sortDirection);
    return (
        <HorizontalScroll
            label={caption}
            variant={variant === 'default' ? 'default' : 'leaderboard'}
        >
            <table
                aria-busy={isLoading || undefined}
                className={clsx(styles.table, variant !== 'default' && styles[`m-${variant}`])}
            >
                <caption className={variant !== 'default' ? 'visually-hidden' : undefined}>
                    {caption}
                </caption>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                aria-sort={getAriaSort(column.sortDirection)}
                                className={clsx(
                                    getCellClass(column),
                                    column.onSort && styles.table__sortable,
                                )}
                                key={column.key}
                                scope="col"
                            >
                                {column.onSort ? (
                                    <button
                                        className={styles.table__sort}
                                        data-direction={column.sortDirection}
                                        disabled={column.isSortDisabled}
                                        onClick={column.onSort}
                                        type="button"
                                    >
                                        {column.header}
                                        <Icon name="chevron-down" />
                                        <span className="visually-hidden">
                                            {getSortLabel(column.sortDirection, hasExplicitSort)}
                                        </span>
                                    </button>
                                ) : (
                                    column.header
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody aria-hidden={isLoading || undefined} inert={isLoading}>
                    {rows.length > 0 ? (
                        rows.map((row) => (
                            <tr key={row.id}>
                                {columns.map((column) => (
                                    <td className={getCellClass(column)} key={column.key}>
                                        {row.cells[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td className={styles.table__empty} colSpan={columns.length}>
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </HorizontalScroll>
    );
}
