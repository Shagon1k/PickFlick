'use client';

import { useEffect, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';

import styles from './SessionLink.module.scss';

// The prototype Invite button confirms the copy in its own label for a moment.
const COPIED_LABEL_MS = 1500;

/** The Session header's Invite cell; its feedback floats under the cell. */
export default function SessionLink({ sessionId }: { sessionId: string }) {
    const [message, setMessage] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    useEffect(() => {
        if (!isCopied) return;
        const timer = setTimeout(() => setIsCopied(false), COPIED_LABEL_MS);
        return () => clearTimeout(timer);
    }, [isCopied]);
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
            // The Button's own success label announces the copy.
            setMessage('');
            setIsCopied(true);
        } catch {
            setMessage(`Copy is unavailable. Open /sessions/${sessionId} and copy its address.`);
        }
    }
    return (
        <div className={styles.cell}>
            <Button onClick={handleCopy} variant="cell" success={isCopied ? 'Copied' : ''}>
                <Icon name="user-plus" />
                Invite
            </Button>
            <span className={isCopied ? 'visually-hidden' : styles.feedback} role="status">
                {isCopied ? '' : message}
            </span>
        </div>
    );
}
