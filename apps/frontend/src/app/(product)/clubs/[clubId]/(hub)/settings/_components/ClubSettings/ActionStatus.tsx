'use client';

import { type IClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';

import styles from '../../page.module.scss';

/**
 * Errors stay on screen; a success is announced but not shown, the change itself is the feedback.
 * Pass `shouldAnnounceSuccess={false}` when the submit Button already announces its own success label.
 */
export default function ActionStatus({
    state,
    shouldAnnounceSuccess = true,
}: {
    state: IClubActionState;
    shouldAnnounceSuccess?: boolean;
}) {
    return (
        <p
            aria-atomic="true"
            aria-live="polite"
            className={state.status === 'success' ? 'visually-hidden' : styles.status}
            data-tone={state.status}
            role="status"
        >
            {state.status === 'success' && !shouldAnnounceSuccess ? '' : state.message}
        </p>
    );
}
