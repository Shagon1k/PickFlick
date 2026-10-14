'use client';

import { type IClubSettings } from '@pickflick/contracts';
import { useActionState } from 'react';

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
                        const isLocked = name === 'showVoteResults' && areResultsLocked;
                        return (
                            <div key={name}>
                                <label className={styles.check}>
                                    <span>{label}</span>
                                    <input
                                        defaultChecked={projection.visibility[name]}
                                        disabled={isLocked}
                                        name={name}
                                        type="checkbox"
                                    />
                                </label>
                                {isLocked ? (
                                    <p className={styles.checkNote}>
                                        Free Clubs keep individual Selection results hidden.
                                    </p>
                                ) : null}
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
