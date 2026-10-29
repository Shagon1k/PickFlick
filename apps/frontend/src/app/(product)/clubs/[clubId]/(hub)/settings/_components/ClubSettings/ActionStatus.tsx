'use client';

import { type IClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';

import styles from '../../page.module.scss';

export default function ActionStatus({ state }: { state: IClubActionState }) {
    return (
        <p
            aria-atomic="true"
            aria-live="polite"
            className={styles.status}
            data-tone={state.status}
            role="status"
        >
            {state.message}
        </p>
    );
}
