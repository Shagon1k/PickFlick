import type { TRatingsCsvResult } from '@pickflick/contracts';

import Table from '#components/ui/Table/Table';
import { formatCount } from '#lib/format';

import styles from './RatingsCsv.module.scss';

export default function CsvPreview({ result }: { result: TRatingsCsvResult }) {
    const counts = {
        create: result.rows.filter((row) => row.action === 'create').length,
        update: result.rows.filter((row) => row.action === 'update').length,
        unchanged: result.rows.filter((row) => row.action === 'unchanged').length,
    };
    return (
        <div className={styles.preview}>
            <p role="status" aria-live="polite">
                {result.imported ? 'Import complete.' : 'Validation complete.'}{' '}
                {formatCount(result.total, 'record')}: {counts.create} new, {counts.update} changed,{' '}
                {counts.unchanged} unchanged.{' '}
                {result.errors.length
                    ? `${result.errors.length} invalid records. Nothing imported. Fix every error and preview again.`
                    : 'No invalid records.'}
            </p>
            {result.errors.length ? (
                <ul aria-label="CSV errors">
                    {result.errors.map((error) => (
                        <li key={error.row}>
                            Record {error.row}: {error.message}
                        </li>
                    ))}
                </ul>
            ) : null}
            {result.rows.length ? (
                <details>
                    <summary>Review {formatCount(result.rows.length, 'valid rating')}</summary>
                    <Table
                        caption="Ratings import preview"
                        columns={[
                            { key: 'row', header: 'Record' },
                            { key: 'name', header: 'Movie' },
                            { key: 'current', header: 'Current' },
                            { key: 'rating', header: 'Imported' },
                            { key: 'action', header: 'Action' },
                        ]}
                        rows={result.rows.map((row) => ({
                            id: row.movieId,
                            cells: {
                                row: row.row,
                                name: row.name,
                                current: row.currentRating ?? '—',
                                rating: row.rating,
                                action: row.action,
                            },
                        }))}
                    />
                </details>
            ) : null}
        </div>
    );
}
