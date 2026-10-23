'use client';

import type { TRating } from '@pickflick/contracts';
import { type ReactNode, useState, useTransition } from 'react';

import { closeRatingAction } from '#app/(product)/sessions/[sessionId]/rating-actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { getOfflineMessage } from '#lib/offline';

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
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function handleConfirm(confirmation: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('Completing Session…');
        startTransition(async () => {
            const result = await closeRatingAction(sessionId, { phaseVersion, confirmation }).catch(
                () => ({ ok: false, message: 'We could not reach PickFlick. Try again.' }),
            );
            setMessage(result.ok ? '' : result.message);
            if (result.ok) setIsOpen(false);
        });
    }
    return (
        <>
            {children(
                data.canClose
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
                title="Close Rating early"
                word="CLOSE"
                inputId="close-rating-confirmation"
                confirmLabel="Complete Session"
                cancelLabel="Keep Rating open"
                pending={isPending}
                tone="neutral"
                status={<p role="status">{message}</p>}
            >
                <p>
                    Complete this Session with {data.receivedCount} received ratings.{' '}
                    {data.acceptedCount - data.submittedCount} current participants have not rated.
                    Saved ratings stay unchanged; no more ratings can be added.
                </p>
            </ConfirmDialog>
        </>
    );
}
