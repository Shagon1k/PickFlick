'use client';

import { useEffect, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';

import styles from './SessionCreatedToast.module.scss';

const COPIED_LABEL_MS = 1500;

/** Offers the new Session's link once, right after scheduling; a reload does not bring it back. */
export default function SessionCreatedToast({ sessionId }: { sessionId: string }) {
    const [state, setState] = useState<'open' | 'copied' | 'failed' | 'closed'>('open');
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('created');
        window.history.replaceState(window.history.state, '', url);
    }, []);
    useEffect(() => {
        if (state !== 'copied') return;
        const timer = setTimeout(() => setState('closed'), COPIED_LABEL_MS);
        return () => clearTimeout(timer);
    }, [state]);
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
            setState('copied');
        } catch {
            setState('failed');
        }
    }
    if (state === 'closed') return null;
    return (
        <aside aria-label="Share this Session" className={styles.toast}>
            <p role="status">
                {state === 'failed'
                    ? 'Copy is unavailable. Copy this page’s address instead.'
                    : 'Share this Session with your Club.'}
            </p>
            <Button
                onClick={handleCopy}
                size="small"
                variant="secondary"
                success={state === 'copied' ? 'Copied' : ''}
            >
                Copy link
            </Button>
            <button
                aria-label="Dismiss"
                className={styles.dismiss}
                onClick={() => setState('closed')}
                type="button"
            >
                <Icon name="close" />
            </button>
        </aside>
    );
}
