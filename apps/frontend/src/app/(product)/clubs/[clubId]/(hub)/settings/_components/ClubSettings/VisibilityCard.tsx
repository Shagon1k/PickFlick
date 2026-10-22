'use client';

import { type IClubSettings } from '@pickflick/contracts';
import { useActionState, useId } from 'react';

import InfoTip from '#components/ui/InfoTip/InfoTip';
import Pill from '#components/ui/Pill/Pill';

import { initialClubActionState } from '../../action-state';
import { updateClubSettingsAction } from '../../actions';
import styles from '../../page.module.scss';
import { isWritable, visibilityOptions } from './club-settings';
import SaveRow from './SaveRow';
import StoredClubInfo from './StoredClubInfo';

export default function VisibilityCard({ projection }: { projection: IClubSettings }) {
    const action = updateClubSettingsAction.bind(null, projection.club.id);
    const [state, formAction, isPending] = useActionState(action, initialClubActionState);
    const canEdit = isWritable(projection);
    const areResultsLocked = projection.entitlements.voteResultVisibility !== 'ADMIN_CONFIGURABLE';
    return (
        <section aria-labelledby="club-visibility-title" className={styles.card}>
            <h2 id="club-visibility-title">Settings</h2>
            <form action={formAction} className={styles.cardForm}>
                <StoredClubInfo projection={projection} />
                <fieldset className={styles.checks} disabled={!canEdit}>
                    <legend className="visually-hidden">Visibility and presentation</legend>
                    {visibilityOptions.map(({ label, name }) => {
                        if (name === 'showVoteResults' && areResultsLocked)
                            return <LockedResultsOption key={name} label={label} />;
                        return (
                            <div key={name}>
                                <label className={styles.check}>
                                    <span>{label}</span>
                                    <input
                                        defaultChecked={projection.visibility[name]}
                                        name={name}
                                        type="checkbox"
                                    />
                                </label>
                            </div>
                        );
                    })}
                </fieldset>
                {projection.permissions.manageSettings ? (
                    <SaveRow disabled={!canEdit} pending={isPending} state={state} />
                ) : null}
            </form>
        </section>
    );
}

/** A Pro capability reads as one, with the reason one tap away instead of a bare disabled box. */
function LockedResultsOption({ label }: { label: string }) {
    const labelId = useId();
    return (
        <div className={styles.check}>
            <span className={styles.lockedLabel}>
                <span id={labelId}>{label}</span>
                <Pill tone="warm">Pro</Pill>
                <InfoTip label="About Selection result visibility">
                    Free Clubs keep individual Selection results hidden. On Pro, the Club Admin
                    chooses whether members see them after Selection closes.
                </InfoTip>
            </span>
            <input aria-labelledby={labelId} disabled type="checkbox" />
        </div>
    );
}
