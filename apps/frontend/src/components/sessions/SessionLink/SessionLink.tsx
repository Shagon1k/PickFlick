'use client';

import { useState } from 'react';

import Button from '#components/ui/Button/Button';

import styles from './SessionLink.module.scss';

export default function SessionLink({
    sessionId,
    compact = false,
}: {
    sessionId: string;
    compact?: boolean;
}) {
    const [message, setMessage] = useState('');
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`);
            setMessage('Session link copied. Share it with your Club.');
        } catch {
            setMessage(`Copy is unavailable. Open /sessions/${sessionId} and copy its address.`);
        }
    }
    return (
        <div className={compact ? styles.compact : undefined}>
            <Button onClick={handleCopy} variant="secondary">
                {compact ? 'Invite' : 'Copy Session link'}
            </Button>
            {!compact ? (
                <p>
                    Any Club member can use this link. Joining stays open until the Session is
                    completed or cancelled.
                </p>
            ) : null}
            <p className={compact ? styles.feedback : undefined} role="status">
                {message}
            </p>
        </div>
    );
}
