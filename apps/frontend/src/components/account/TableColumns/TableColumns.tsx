'use client';

import { OPTIONAL_TABLE_COLUMNS, type TAppearance } from '@pickflick/contracts';

import Switch from '#components/ui/Switch/Switch';

import styles from './TableColumns.module.scss';

const LABELS = { rank: 'Rank', year: 'Year', genre: 'Genre', date: 'Date' };
export default function TableColumns({
    hiddenColumns,
    onChange,
    availableColumns = OPTIONAL_TABLE_COLUMNS,
    disabled = false,
    isSaving = false,
}: {
    hiddenColumns: TAppearance['hiddenColumns'];
    onChange: (columns: TAppearance['hiddenColumns']) => void;
    availableColumns?: readonly string[];
    disabled?: boolean;
    isSaving?: boolean;
}) {
    return (
        <details className={styles.columns} aria-busy={isSaving || undefined}>
            <summary>Table columns</summary>
            <div className={styles.columns__options}>
                <p>
                    Film and Rating/Priority always remain visible. This setup applies to all your
                    film tables.
                </p>
                {OPTIONAL_TABLE_COLUMNS.filter((key) => availableColumns.includes(key)).map(
                    (key) => (
                        <Switch
                            key={key}
                            label={LABELS[key]}
                            checked={!hiddenColumns.includes(key)}
                            disabled={disabled}
                            aria-disabled={isSaving || disabled}
                            onChange={(event) => {
                                if (isSaving) return;
                                onChange(
                                    event.currentTarget.checked
                                        ? hiddenColumns.filter((column) => column !== key)
                                        : [...hiddenColumns, key],
                                );
                            }}
                        />
                    ),
                )}
            </div>
        </details>
    );
}
