'use client';

import { type ReactNode, useState } from 'react';

import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { useActionStatus } from '#lib/use-action-status';

interface IPhaseTransitionDialogProps {
    sessionId: string;
    phaseVersion: number;
    canStart: boolean;
    action: (
        sessionId: string,
        input: { phaseVersion: number; confirmation: string },
    ) => Promise<{ ok: boolean; message?: string }>;
    copy: {
        title: string;
        word: string;
        inputId: string;
        confirmLabel: string;
        cancelLabel: string;
        pendingMessage: string;
    };
    /** What the transition changes, shown above the confirmation field. */
    description: ReactNode;
    /** Renders the trigger area; `onStart` is absent when the viewer cannot start the transition. */
    children: (onStart?: () => void) => ReactNode;
}

/** A manual phase transition that the operator confirms by typing a word. */
export default function PhaseTransitionDialog({
    sessionId,
    phaseVersion,
    canStart,
    action,
    copy,
    description,
    children,
}: IPhaseTransitionDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { message, setMessage, isPending, run } = useActionStatus();
    function handleConfirm(confirmation: string) {
        run(() => action(sessionId, { phaseVersion, confirmation }), {
            pendingMessage: copy.pendingMessage,
            onResult: (result) => {
                setMessage(result.message ?? '');
                if (result.ok) setIsOpen(false);
            },
        });
    }
    return (
        <>
            {children(
                canStart
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
                title={copy.title}
                word={copy.word}
                inputId={copy.inputId}
                confirmLabel={copy.confirmLabel}
                cancelLabel={copy.cancelLabel}
                isPending={isPending}
                tone="neutral"
                status={<p role="status">{message}</p>}
            >
                {description}
            </ConfirmDialog>
        </>
    );
}
