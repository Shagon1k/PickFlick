'use client';

import { useState, useTransition } from 'react';

import { useAccount, useAppearance } from '#components/account/account-context';
import { saveAppearance } from '#components/account/actions';
import TableColumns from '#components/account/TableColumns/TableColumns';
import Table, { type ITableProps } from '#components/ui/Table/Table';
import { getOfflineMessage } from '#lib/offline';

export default function PersonalFilmTable(props: ITableProps) {
    const { account, setAccount } = useAccount();
    const appearance = useAppearance();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    return (
        <>
            <TableColumns
                hiddenColumns={appearance.hiddenColumns}
                availableColumns={props.columns.map(({ key }) => key)}
                disabled={!account}
                isSaving={isPending}
                onChange={(hiddenColumns) => {
                    const offline = getOfflineMessage();
                    if (offline) {
                        setMessage(offline);
                        return;
                    }
                    startTransition(async () => {
                        const result = await saveAppearance({ ...appearance, hiddenColumns });
                        if (result.ok) {
                            setAccount(result.data);
                            setMessage('Table columns saved.');
                        } else setMessage(result.message);
                    });
                }}
            />
            <p hidden={!message && !isPending} role="status">
                {isPending ? 'Saving table columns…' : message}
            </p>
            <Table
                {...props}
                hasExplicitSort={props.columns.some((column) => column.sortDirection)}
                columns={props.columns.filter(
                    ({ key }) => !appearance.hiddenColumns.some((hidden) => hidden === key),
                )}
            />
        </>
    );
}
