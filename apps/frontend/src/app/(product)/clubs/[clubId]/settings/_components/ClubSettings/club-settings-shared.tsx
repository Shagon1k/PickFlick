'use client';

import { type IClubSettings } from '@pickflick/contracts';

import Button from '@/components/ui/Button/Button';

import { type IClubActionState } from '../../action-state';
import styles from '../../page.module.scss';

export function ActionStatus({ state }: { state: IClubActionState }) {
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

export type TVisibilityName =
    | 'showNominationAuthors'
    | 'showNominationsBeforeSubmit'
    | 'showVoteResults'
    | 'showRatingResults'
    | 'useMonochromeMedia';

export const visibilityOptions: ReadonlyArray<{
    readonly name: TVisibilityName;
    readonly label: string;
}> = [
    { name: 'showNominationAuthors', label: 'Show who nominated each film' },
    { name: 'showNominationsBeforeSubmit', label: 'Show nominations before I submit' },
    { name: 'showVoteResults', label: 'Show Selection results after the round closes' },
    { name: 'showRatingResults', label: 'Show ratings after the round closes' },
    { name: 'useMonochromeMedia', label: 'Use black & white posters and trailers' },
];

export function isWritable(projection: IClubSettings): boolean {
    return projection.permissions.manageSettings && projection.club.lifecycle === 'ACTIVE';
}

/**
 * Club Info and Settings save through one settings action; each card submits its own fields and
 * carries the other card's stored values so a save never resets what the other card shows.
 */
export function StoredClubInfo({ projection }: { projection: IClubSettings }) {
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

export function StoredVisibility({ projection }: { projection: IClubSettings }) {
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
}: {
    disabled: boolean;
    pending: boolean;
    state: IClubActionState;
}) {
    return (
        <div className={styles.saveRow}>
            <div className={styles.saveButton}>
                <Button disabled={disabled} fullWidth loading={pending} size="small" type="submit">
                    Save Changes
                </Button>
            </div>
            <ActionStatus state={state} />
        </div>
    );
}
