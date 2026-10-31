'use client';

import type { TSession } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';

import { cancelSessionAction } from '#components/sessions/session-actions';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { useActionStatus } from '#lib/use-action-status';

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
    const { message, setMessage, isPending, run } = useActionStatus();
    function handleConfirm(confirmation: string) {
        run(() => cancelSessionAction(session.id, { version: session.version, confirmation }), {
            onResult: (result) => {
                setMessage(result.message);
                if (result.ok) {
                    onClose();
                    router.refresh();
                }
            },
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
            isPending={isPending}
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
