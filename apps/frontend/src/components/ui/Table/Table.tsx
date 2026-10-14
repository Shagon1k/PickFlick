import type { ReactNode } from 'react';

import styles from './Table.module.scss';

export interface ITableColumn {
    key: string;
    header: ReactNode;
    numeric?: boolean;
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
}

/** A semantic table whose dense content scrolls inside its own region, never the page. */
export default function Table({
    caption,
    columns,
    emptyMessage = 'No records yet.',
    rows,
}: ITableProps) {
    const getCellClass = (column: ITableColumn) =>
        column.numeric ? styles.table__numeric : undefined;
    return (
        <div
            aria-label={`${caption} scroll region`}
            className={styles.table__scroll}
            role="region"
            tabIndex={0}
        >
            <table className={styles.table}>
                <caption>{caption}</caption>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th className={getCellClass(column)} key={column.key} scope="col">
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
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
        </div>
    );
}
