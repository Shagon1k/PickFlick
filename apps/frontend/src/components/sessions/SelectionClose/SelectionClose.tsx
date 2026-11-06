'use client';

import type { ReactNode } from 'react';

import PhaseTransitionDialog from '#components/sessions/PhaseTransitionDialog/PhaseTransitionDialog';
import { closeSelectionAction } from '#components/sessions/selection-actions';

export default function SelectionClose({
    sessionId,
    phaseVersion,
    submittedCount,
    acceptedCount,
    canClose,
    children,
}: {
    sessionId: string;
    phaseVersion: number;
    submittedCount: number;
    acceptedCount: number;
    canClose: boolean;
    children: (onClose?: () => void) => ReactNode;
}) {
    return (
        <PhaseTransitionDialog
            sessionId={sessionId}
            phaseVersion={phaseVersion}
            canStart={canClose}
            action={closeSelectionAction}
            copy={{
                title: 'Close Selection early',
                word: 'CLOSE',
                inputId: 'close-selection-confirmation',
                confirmLabel: 'Confirm close',
                cancelLabel: 'Keep Selection open',
                pendingMessage: 'Closing Selection…',
            }}
            description={
                <>
                    <p>
                        {submittedCount} of {acceptedCount} accepted participants have submitted.
                        Close now to choose a winner from all received ballots and move to Watching?
                        Remaining participants cannot submit. Saved scores cannot be changed.
                    </p>
                    {submittedCount === 0 ? (
                        <p>
                            If no ballots were received, all totals are zero and the tie-break rules
                            choose the winner.
                        </p>
                    ) : null}
                </>
            }
        >
            {children}
        </PhaseTransitionDialog>
    );
}
