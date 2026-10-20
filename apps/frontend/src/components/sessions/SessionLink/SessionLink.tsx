'use client';

import { useState } from 'react';

import Button from '#components/ui/Button/Button';

export default function SessionLink({ sessionId }: { sessionId: string }) {
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
