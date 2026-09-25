import type { ReactNode } from 'react';

export interface DataTableColumn {
    readonly key: string;
    readonly header: ReactNode;
    readonly numeric?: boolean;
}

export interface DataTableRow {
    readonly id: string;
    readonly cells: Readonly<Record<string, ReactNode>>;
}

export interface DataTableProps {
    readonly caption: string;
    readonly columns: readonly DataTableColumn[];
    readonly rows: readonly DataTableRow[];
    readonly emptyMessage?: string;
}

export function DataTable({
    caption,
    columns,
    emptyMessage = 'No records yet.',
    rows,
}: DataTableProps) {
    return (
        <div
            aria-label={`${caption} scroll region`}
            className="pf-table-scroll"
            role="region"
            tabIndex={0}
        >
            <table className="pf-table">
                <caption>{caption}</caption>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                className={column.numeric ? 'pf-table__numeric' : undefined}
                                key={column.key}
                                scope="col"
                            >
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
                                    <td
                                        className={column.numeric ? 'pf-table__numeric' : undefined}
                                        key={column.key}
                                    >
                                        {row.cells[column.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td className="pf-table__empty" colSpan={columns.length}>
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
