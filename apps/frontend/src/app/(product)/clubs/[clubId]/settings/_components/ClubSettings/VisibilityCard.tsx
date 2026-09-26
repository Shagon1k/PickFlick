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
    const [state, formAction, pending] = useActionState(action, initialClubActionState);
    const writable = isWritable(projection);
    const resultsLocked = projection.entitlements.voteResultVisibility !== 'ADMIN_CONFIGURABLE';
    return (
        <section aria-labelledby="club-visibility-title" className={styles.card}>
            <h2 id="club-visibility-title">Settings</h2>
            <form action={formAction} className={styles.cardForm}>
                <StoredClubInfo projection={projection} />
                <fieldset className={styles.checks} disabled={!writable}>
                    <legend className="visually-hidden">Visibility and presentation</legend>
                    {visibilityOptions.map(({ label, name }) => {
                        const locked = name === 'showVoteResults' && resultsLocked;
                        return (
                            <div key={name}>
                                <label className={styles.check}>
                                    <span>{label}</span>
                                    <input
                                        defaultChecked={projection.visibility[name]}
                                        disabled={locked}
                                        name={name}
                                        type="checkbox"
                                    />
                                </label>
                                {locked ? (
                                    <p className={styles.checkNote}>
                                        Free Clubs keep individual Selection results hidden.
                                    </p>
                                ) : null}
                            </div>
                        );
                    })}
                </fieldset>
                {projection.permissions.manageSettings ? (
                    <SaveRow disabled={!writable} pending={pending} state={state} />
                ) : null}
            </form>
        </section>
    );
}
