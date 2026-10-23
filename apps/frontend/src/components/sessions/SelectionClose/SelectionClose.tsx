'use client';

import { type ReactNode, useState, useTransition } from 'react';

import { closeSelectionAction } from '#app/(product)/sessions/[sessionId]/selection-actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

interface ISelectionCloseProps {
    sessionId: string;
    phaseVersion: number;
    submittedCount: number;
    acceptedCount: number;
    canClose: boolean;
    children: (onClose?: () => void) => ReactNode;
}

export default function SelectionClose({
    sessionId,
    phaseVersion,
    submittedCount,
    acceptedCount,
    canClose,
    children,
}: ISelectionCloseProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function handleConfirm(confirmation: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        startTransition(async () => {
            const result = await closeSelectionAction(sessionId, {
                phaseVersion,
                confirmation,
            }).catch(() => ({ ok: false, message: 'We could not reach PickFlick. Try again.' }));
            if (result.ok) setIsOpen(false);
            else setMessage(result.message);
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
                open={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={handleConfirm}
                title="Close Selection early"
                word="CLOSE"
                inputId="close-selection-confirmation"
                confirmLabel="Confirm close"
                cancelLabel="Keep Selection open"
                pending={isPending}
                tone="neutral"
                status={<p role="status">{message}</p>}
            >
                <p>
                    {submittedCount} of {acceptedCount} accepted participants have submitted. Close
                    now to choose a winner from all received ballots and move to Watching? Remaining
                    participants cannot submit. Saved scores cannot be changed.
                </p>
                {submittedCount === 0 ? (
                    <p>
                        If no ballots were received, all totals are zero and the tie-break rules
                        choose the winner.
                    </p>
                ) : null}
            </ConfirmDialog>
        </>
    );
}
