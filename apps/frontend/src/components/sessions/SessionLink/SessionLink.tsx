'use client';

import { useEffect, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';

import styles from './SessionLink.module.scss';

// The prototype Invite button confirms the copy in its own label for a moment.
const COPIED_LABEL_MS = 1500;

export default function SessionLink({
    sessionId,
    isCell = false,
}: {
    sessionId: string;
    /** The Session header's action-rail cell; its feedback floats under the cell. */
    isCell?: boolean;
}) {
    const [message, setMessage] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    useEffect(() => {
        if (!isCopied) return;
        const timer = setTimeout(() => {
            setIsCopied(false);
            setMessage('');
        }, COPIED_LABEL_MS);
        return () => clearTimeout(timer);
    }, [isCopied]);
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
            setMessage('Session link copied. Share it with your Club.');
            setIsCopied(true);
        } catch {
            setMessage(`Copy is unavailable. Open /sessions/${sessionId} and copy its address.`);
        }
    }
    if (isCell)
        return (
            <div className={styles.cell}>
                <Button onClick={handleCopy} variant="cell">
                    <Icon name="user-plus" />
                    {isCopied ? 'Copied!' : 'Invite'}
                </Button>
                <span className={isCopied ? 'visually-hidden' : styles.feedback} role="status">
                    {message}
                </span>
            </div>
        );
    return (
        <div>
            <Button onClick={handleCopy} variant="secondary">
                Copy Session link
            </Button>
            <p>
                Any Club member can use this link. Joining stays open until the Session is completed
                or cancelled.
            </p>
            <p role="status">{message}</p>
        </div>
    );
}
