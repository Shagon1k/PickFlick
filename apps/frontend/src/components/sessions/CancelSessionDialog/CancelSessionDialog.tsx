'use client';

import type { TSession } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cancelSessionAction } from '#app/(product)/sessions/[sessionId]/actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

/** Session cancellation with typed `CANCEL`, from the Session page or Manage Club. */
export default function CancelSessionDialog({
    session,
    open,
    onClose,
}: {
    session: Pick<TSession, 'id' | 'version' | 'topic'>;
    open: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    function handleConfirm(confirmation: string) {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
            return;
        }
        startTransition(async () => {
            const result = await cancelSessionAction(session.id, {
                version: session.version,
                confirmation,
            }).catch(() => ({ ok: false, message: 'We could not reach PickFlick. Try again.' }));
            setMessage(result.message);
            if (result.ok) {
                onClose();
                router.refresh();
            }
        });
    }
    return (
        <ConfirmDialog
            cancelLabel="Keep Session"
            confirmLabel="Confirm cancellation"
            inputId="cancel-confirmation"
            onClose={() => {
                setMessage('');
                onClose();
            }}
            onConfirm={handleConfirm}
            open={open}
            pending={isPending}
            status={
                <p aria-live="polite" role="status">
                    {message}
                </p>
            }
            title="Cancel Session"
            word="CANCEL"
        >
            <p>
                Cancel “{session.topic ?? 'Untitled Session'}”? Participation ends and this Club can
                schedule another Session. Existing history stays.
            </p>
        </ConfirmDialog>
    );
}
