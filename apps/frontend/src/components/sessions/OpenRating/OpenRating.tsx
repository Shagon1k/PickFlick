'use client';

import { type ReactNode, useState, useTransition } from 'react';

import { openRatingAction } from '#app/(product)/sessions/[sessionId]/actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

export default function OpenRating({
    sessionId,
    phaseVersion,
    canOpen,
    children,
}: {
    sessionId: string;
    phaseVersion: number;
    canOpen: boolean;
    children: (onOpen?: () => void) => ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function handleConfirm(confirmation: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('Opening Rating…');
        startTransition(async () => {
            const result = await openRatingAction(sessionId, { phaseVersion, confirmation }).catch(
                () => ({ ok: false, message: 'We could not reach PickFlick. Try again.' }),
            );
            setMessage(result.message);
            if (result.ok) setIsOpen(false);
        });
    }
    return (
        <>
            {children(
                canOpen
                    ? () => {
                          setMessage('');
                          setIsOpen(true);
                      }
                    : undefined,
            )}
            <ConfirmDialog
                open={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={handleConfirm}
                title="Open Rating"
                word="OPEN"
                inputId="open-rating-confirmation"
                confirmLabel="Open Rating"
                cancelLabel="Keep Watching"
                pending={isPending}
                tone="neutral"
                status={<p role="status">{message}</p>}
            >
                <p>
                    Finished the screening? Move this Session to Rating and free the Club to start
                    its next Session. The selected Movie and participants stay with this Session.
                </p>
            </ConfirmDialog>
        </>
    );
}
