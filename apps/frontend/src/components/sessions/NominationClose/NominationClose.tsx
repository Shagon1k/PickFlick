'use client';

import type { ReactNode } from 'react';

import { closeNominationsAction } from '#components/sessions/nomination-actions';
import PhaseTransitionDialog from '#components/sessions/PhaseTransitionDialog/PhaseTransitionDialog';

/** Early Nomination closure for the Session page and Manage Club, with typed `CLOSE`. */
export default function NominationClose({
    sessionId,
    phaseVersion,
    canClose,
    children,
}: {
    sessionId: string;
    phaseVersion: number;
    canClose: boolean;
    children: (onClose?: () => void) => ReactNode;
}) {
    return (
        <PhaseTransitionDialog
            sessionId={sessionId}
            phaseVersion={phaseVersion}
            canStart={canClose}
            action={closeNominationsAction}
            copy={{
                title: 'Close nominations early',
                word: 'CLOSE',
                inputId: 'close-nomination-confirmation',
                confirmLabel: 'Confirm close',
                cancelLabel: 'Keep nominations open',
                pendingMessage: 'Saving…',
            }}
            description={
                <p>
                    End Nomination now? One nomination selects that Movie for Watching. Two or more
                    open Selection. Remaining participants cannot nominate.
                </p>
            }
        >
            {children}
        </PhaseTransitionDialog>
    );
}
