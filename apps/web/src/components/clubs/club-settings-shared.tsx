'use client';

import { useEffect, useRef, useState } from 'react';

import { type ClubSettingsProjection } from '@pickflick/contracts';
import { Button } from '@pickflick/ui';

import { type ClubManagementActionState } from './club-management.types';
import styles from './club-settings.module.css';

export function useOperationId(state: ClubManagementActionState): string {
    const [operationId, setOperationId] = useState('');
    const refreshedRevisionRef = useRef(-1);
    useEffect(() => {
        if (
            !operationId ||
            (state.status === 'success' && refreshedRevisionRef.current !== state.revision)
        ) {
            refreshedRevisionRef.current = state.revision;
            setOperationId(globalThis.crypto.randomUUID());
        }
    }, [operationId, state.revision, state.status]);
    return operationId;
}

export function ActionStatus({ state }: Readonly<{ state: ClubManagementActionState }>) {
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

export type VisibilityName =
    | 'showNominationAuthors'
    | 'showNominationsBeforeSubmit'
    | 'showVoteResults'
    | 'showRatingResults'
    | 'useMonochromeMedia';

export const visibilityOptions: ReadonlyArray<{
    readonly name: VisibilityName;
    readonly label: string;
}> = [
    { name: 'showNominationAuthors', label: 'Show who nominated each film' },
    { name: 'showNominationsBeforeSubmit', label: 'Show nominations before I submit' },
    { name: 'showVoteResults', label: 'Show Selection results after the round closes' },
    { name: 'showRatingResults', label: 'Show ratings after the round closes' },
    { name: 'useMonochromeMedia', label: 'Use black & white posters and trailers' },
];

export function isWritable(projection: ClubSettingsProjection): boolean {
    return projection.permissions.manageSettings && projection.club.lifecycle === 'ACTIVE';
}

/**
 * Club Info and Settings save through one settings action; each card submits its own fields and
 * carries the other card's stored values so a save never resets what the other card shows.
 */
export function StoredClubInfo({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
    return (
        <>
            <input name="name" type="hidden" value={projection.club.name} />
            <input name="description" type="hidden" value={projection.club.description ?? ''} />
            <input
                name="selectionScaleMin"
                type="hidden"
                value={projection.club.selectionScaleMin}
            />
            <input
                name="selectionScaleMax"
                type="hidden"
                value={projection.club.selectionScaleMax}
            />
        </>
    );
}

export function StoredVisibility({ projection }: Readonly<{ projection: ClubSettingsProjection }>) {
    return (
        <>
            {visibilityOptions
                .filter(({ name }) => projection.visibility[name])
                .map(({ name }) => (
                    <input key={name} name={name} type="hidden" value="on" />
                ))}
        </>
    );
}

export function SaveRow({
    disabled,
    pending,
    state,
}: Readonly<{
    disabled: boolean;
    pending: boolean;
    state: ClubManagementActionState;
}>) {
    return (
        <div className={styles.saveRow}>
            <Button
                className={styles.saveButton}
                disabled={disabled}
                loading={pending}
                size="small"
                type="submit"
            >
                Save Changes
            </Button>
            <ActionStatus state={state} />
        </div>
    );
}
