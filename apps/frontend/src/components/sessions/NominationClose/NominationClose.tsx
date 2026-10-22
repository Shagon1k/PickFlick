'use client';

import { type ReactNode, useState, useTransition } from 'react';

import { closeNominationsAction } from '#app/(product)/sessions/[sessionId]/nomination-actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

interface INominationCloseProps {
    sessionId: string;
    phaseVersion: number;
    canClose: boolean;
    children: (onClose?: () => void) => ReactNode;
}

/** Early Nomination closure for the Session page and Manage Club, with typed `CLOSE`. */
export default function NominationClose({
    sessionId,
    phaseVersion,
    canClose,
    children,
}: INominationCloseProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function handleConfirm(confirmation: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('Saving…');
        startTransition(async () => {
            const result = await closeNominationsAction(sessionId, {
                phaseVersion,
                confirmation,
            }).catch(() => ({ ok: false, message: 'We could not reach PickFlick. Try again.' }));
            setMessage(result.message);
            if (result.ok) setIsOpen(false);
        });
    }
    return (
        <>
            {children(
                canClose
                    ? () => {
                          setMessage('');
                          setIsOpen(true);
                      }
                    : undefined,
            )}
            <ConfirmDialog
                cancelLabel="Keep nominations open"
                confirmLabel="Confirm close"
                inputId="close-nomination-confirmation"
                onClose={() => setIsOpen(false)}
                onConfirm={handleConfirm}
                open={isOpen}
                pending={isPending}
                status={<p role="status">{message}</p>}
                title="Close nominations early"
                tone="neutral"
                word="CLOSE"
            >
                <p>
                    End Nomination now? One nomination selects that Movie for Watching. Two or more
                    open Selection. Remaining participants cannot nominate.
                </p>
            </ConfirmDialog>
        </>
    );
}
