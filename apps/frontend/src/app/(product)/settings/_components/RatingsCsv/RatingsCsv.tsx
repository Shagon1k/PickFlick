'use client';

import { RATINGS_CSV_MAX_BYTES, type TRatingsCsvResult } from '@pickflick/contracts';
import { useRef, useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import { formatCount } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';

import { downloadCsv, importCsv, previewCsv } from '../../actions';
import settings from '../../page.module.scss';
import CsvPreview from './CsvPreview';
import styles from './RatingsCsv.module.scss';

export default function RatingsCsv() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<TRatingsCsvResult | null>(null);
    const [message, setMessage] = useState('');
    const [exportMessage, setExportMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const [pendingAction, setPendingAction] = useState('');

    function handleUpload(shouldImport: boolean) {
        if (!file) return;
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('');
        setPendingAction(shouldImport ? 'import' : 'preview');
        const form = new FormData();
        form.set('csv', file);
        startTransition(async () => {
            try {
                const result = await (shouldImport ? importCsv(form) : previewCsv(form));
                if (result.ok) setPreview(result.data);
                else setMessage(result.message);
            } catch {
                setMessage(
                    'The connection was interrupted. Try again. Repeating an import is safe.',
                );
            }
        });
    }

    function handleExport() {
        const offline = getOfflineMessage();
        if (offline) {
            setExportMessage(offline);
            return;
        }
        setExportMessage('');
        setPendingAction('export');
        startTransition(async () => {
            try {
                const result = await downloadCsv();
                if (!result.ok) {
                    setExportMessage(result.message);
                    return;
                }
                const url = URL.createObjectURL(
                    new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' }),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = 'pickflick-ratings-v1.csv';
                link.click();
                URL.revokeObjectURL(url);
                setExportMessage(
                    result.data.count
                        ? `Exported ${formatCount(result.data.count, 'rating')}.`
                        : 'You have no personal ratings yet. Downloaded an empty CSV template.',
                );
            } catch {
                setExportMessage('The download was interrupted. Try again.');
            }
        });
    }

    return (
        <div className={styles.csv}>
            <section
                className={settings.card}
                aria-labelledby="csv-import-heading"
                aria-busy={isPending}
            >
                <h2 id="csv-import-heading">Import Movie Ratings</h2>
                <p>
                    Upload a PickFlick version 1 CSV with <code>version,movie_id,name,rating</code>{' '}
                    columns. Max 512 KiB and 1,000 ratings. Movie IDs must exist in this catalog;
                    names are descriptive only.
                </p>
                <p>
                    Preview before importing. Changed scores replace your current Personal Ratings.
                    Session history stays unchanged. Any invalid record blocks the whole file.
                </p>
                <div className={settings.actions}>
                    <Button
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => inputRef.current?.click()}
                    >
                        <Icon name="import-export" />
                        Choose file
                    </Button>
                    <input
                        ref={inputRef}
                        className="visually-hidden"
                        tabIndex={-1}
                        type="file"
                        accept=".csv,text/csv"
                        aria-label="Ratings CSV file"
                        disabled={isPending}
                        onChange={(event) => {
                            const next = event.currentTarget.files?.[0] ?? null;
                            setPreview(null);
                            setMessage('');
                            setFile(next);
                            if (next && next.size > RATINGS_CSV_MAX_BYTES) {
                                setFile(null);
                                setMessage('File exceeds 512 KiB. Split it and try again.');
                            }
                        }}
                    />
                    <span className={styles.filename}>{file?.name ?? 'No file chosen'}</span>
                    <Button
                        disabled={!file || isPending}
                        loading={isPending && pendingAction === 'preview'}
                        onClick={() => handleUpload(false)}
                    >
                        Preview import
                    </Button>
                </div>
                <p role="status" aria-live="polite">
                    {message}
                </p>
                {preview ? <CsvPreview result={preview} /> : null}
                {preview && !preview.errors.length && !preview.imported ? (
                    <div className={settings.actions}>
                        <Button
                            loading={isPending && pendingAction === 'import'}
                            disabled={isPending}
                            onClick={() => handleUpload(true)}
                        >
                            Confirm import
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={isPending}
                            onClick={() => setPreview(null)}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : null}
            </section>
            <section className={settings.card} aria-labelledby="csv-export-heading">
                <h2 id="csv-export-heading">Export Movie Ratings</h2>
                <p>
                    Download your current Personal Ratings as a version 1 CSV. Formula-like names
                    are escaped for spreadsheets. Only your ratings are included. An empty Library
                    downloads a template.
                </p>
                <div className={settings.actions}>
                    <Button
                        loading={isPending && pendingAction === 'export'}
                        disabled={isPending}
                        onClick={handleExport}
                    >
                        <Icon name="export" />
                        Export ratings
                    </Button>
                </div>
                <p role="status" aria-live="polite">
                    {exportMessage}
                </p>
            </section>
        </div>
    );
}
