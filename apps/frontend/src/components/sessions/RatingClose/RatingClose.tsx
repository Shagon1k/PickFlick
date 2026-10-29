'use client';

import type { TRating } from '@pickflick/contracts';
import type { ReactNode } from 'react';

import PhaseTransitionDialog from '#components/sessions/PhaseTransitionDialog/PhaseTransitionDialog';
import { closeRatingAction } from '#components/sessions/rating-actions';

export default function RatingClose({
    sessionId,
    phaseVersion,
    data,
    children,
}: {
    sessionId: string;
    phaseVersion: number;
    data: TRating;
    children: (onClose?: () => void) => ReactNode;
}) {
    return (
        <PhaseTransitionDialog
            sessionId={sessionId}
            phaseVersion={phaseVersion}
            canStart={data.canClose}
            action={closeRatingAction}
            copy={{
                title: 'Close Rating early',
                word: 'CLOSE',
                inputId: 'close-rating-confirmation',
                confirmLabel: 'Complete Session',
                cancelLabel: 'Keep Rating open',
                pendingMessage: 'Completing Session…',
            }}
            description={
                <p>
                    Complete this Session with {data.receivedCount} received ratings.{' '}
                    {data.acceptedCount - data.submittedCount} current participants have not rated.
                    Saved ratings stay unchanged; no more ratings can be added.
                </p>
            }
        >
            {children}
        </PhaseTransitionDialog>
    );
}
