'use client';

import type { TDataExportJob } from '@pickflick/contracts';
import { useEffect, useRef, useState, useTransition } from 'react';

import { downloadDataExport } from '#api/data-exports.client';
import Button from '#components/ui/Button/Button';
import { getOfflineMessage } from '#lib/offline';

import { prepareArchiveDownload, readArchive, requestArchive } from '../../archive-actions';
import styles from '../../page.module.scss';

const STATUS_COPY = {
    PENDING:
        'Your archive is queued. Refresh its status to check progress. Failed attempts retry automatically.',
    PROCESSING: 'Your archive is being prepared. Refresh its status to check progress.',
    READY: 'Your archive is ready. Downloading does not extend its availability.',
    FAILED: 'Your archive could not be prepared. You can request another archive.',
    EXPIRED: 'This archive has expired. You can request another archive.',
};

export default function DataArchive({ archiveId }: { archiveId?: string }) {
    const [job, setJob] = useState<TDataExportJob | null>(null);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const requestIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!archiveId) return;
        startTransition(async () => {
            try {
                const result = await readArchive(archiveId);
                if (result.ok) setJob(result.data);
                else setMessage(result.message);
            } catch {
                setMessage('Archive status could not be loaded. Refresh its status to try again.');
            }
        });
    }, [archiveId]);

    function handleRequest() {
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        requestIdRef.current ??= crypto.randomUUID();
        const id = requestIdRef.current;
        setMessage('');
        startTransition(async () => {
            try {
                const result = await requestArchive({ requestId: id });
                if (!result.ok) return setMessage(result.message);
                setJob(result.data);
                requestIdRef.current = null;
                const url = new URL(window.location.href);
                url.searchParams.set('archive', result.data.id);
                window.history.replaceState(null, '', url);
            } catch {
                setMessage(
                    'The connection was interrupted. Try again; the same request will be reused.',
                );
            }
        });
    }

    function handleRefresh() {
        const id = job?.id ?? archiveId;
        if (!id) return;
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        setMessage('');
        startTransition(async () => {
            try {
                const result = await readArchive(id);
                if (result.ok) setJob(result.data);
                else setMessage(result.message);
            } catch {
                setMessage('Archive status could not be loaded. Refresh its status to try again.');
            }
        });
    }

    function handleDownload() {
        if (!job) return;
        const offline = getOfflineMessage();
        if (offline) return setMessage(offline);
        setMessage('');
        startTransition(async () => {
            try {
                const result = await prepareArchiveDownload(job.id);
                if (!result.ok) return setMessage(result.message);
                const failure = await downloadDataExport(result.data.url);
                if (failure) return setMessage(failure);
                setMessage('Archive downloaded. Keep it private; it contains personal data.');
            } catch {
                setMessage('The download was interrupted. Try again.');
            }
        });
    }

    const isActive = job?.status === 'PENDING' || job?.status === 'PROCESSING';
    return (
        <section className={styles.card} aria-labelledby="archive-heading" aria-busy={isPending}>
            <h2 id="archive-heading">Personal data archive</h2>
            <p>
                Request a private gzip-compressed JSON archive of your stored data. Its manifest
                explains included fields and exclusions. It excludes credentials, other users’
                private data, provider/mailbox copies, logs and backups.
            </p>
            <p>
                Available for seven days after generation. Downloads do not extend that period and
                require your signed-in account. Keep this page address to return to the request.
            </p>
            <div className={styles.actions}>
                <Button disabled={isPending || isActive} onClick={handleRequest}>
                    {job ? 'Request another archive' : 'Request archive'}
                </Button>
                {job || archiveId ? (
                    <Button variant="secondary" disabled={isPending} onClick={handleRefresh}>
                        Refresh status
                    </Button>
                ) : null}
                {job?.status === 'READY' ? (
                    <Button variant="secondary" disabled={isPending} onClick={handleDownload}>
                        Download archive
                    </Button>
                ) : null}
            </div>
            <div role="status" className={styles.feedback}>
                {isPending ? <p>Working…</p> : null}
                {job ? <p>{STATUS_COPY[job.status]}</p> : null}
                {job?.status === 'READY' && job.expiresAt ? (
                    <p>
                        Available until{' '}
                        <time dateTime={job.expiresAt}>
                            {new Date(job.expiresAt).toLocaleString('en-GB')}
                        </time>
                        .
                    </p>
                ) : null}
                {message ? <p>{message}</p> : null}
            </div>
        </section>
    );
}
