'use client';

import type { ReactNode } from 'react';

import PhaseTransitionDialog from '#components/sessions/PhaseTransitionDialog/PhaseTransitionDialog';
import { openRatingAction } from '#components/sessions/rating-actions';

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
    return (
        <PhaseTransitionDialog
            sessionId={sessionId}
            phaseVersion={phaseVersion}
            canStart={canOpen}
            action={openRatingAction}
            copy={{
                title: 'Open Rating',
                word: 'OPEN',
                inputId: 'open-rating-confirmation',
                confirmLabel: 'Open Rating',
                cancelLabel: 'Keep Watching',
                pendingMessage: 'Opening Rating…',
            }}
            description={
                <p>
                    Finished the screening? Move this Session to Rating and free the Club to start
                    its next Session. The selected Movie and participants stay with this Session.
                </p>
            }
        >
            {children}
        </PhaseTransitionDialog>
    );
}
