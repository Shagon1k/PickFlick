'use client';

import type { IClubSettings } from '@pickflick/contracts';
import { useActionState } from 'react';

import { initialClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { updateClubSettingsAction } from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import SelectionScaleField from '#components/clubs/SelectionScaleField/SelectionScaleField';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Tabs from '#components/ui/Tabs/Tabs';

import styles from '../../page.module.scss';
import { visibilityOptions } from './club-settings';
import SaveRow from './SaveRow';

export default function VisibilityCard({ projection }: { projection: IClubSettings }) {
    const action = updateClubSettingsAction.bind(null, projection.club.id);
    const [state, formAction, isPending] = useActionState(action, initialClubActionState);
    const canEdit = projection.permissions.manageSettings;
    return (
        <section aria-labelledby="club-visibility-title" className={styles.card}>
            <div className={styles.cardTitle}>
                <h2 id="club-visibility-title">Settings</h2>
                <InfoTip label="About visibility settings">
                    Saved rules apply to everyone and to all existing and future Sessions in this
                    Club. Club rating averages stay visible.
                </InfoTip>
            </div>
            <form action={formAction} className={styles.cardForm}>
                {/* No control edits this rule yet, but the card saves every visibility flag. */}
                {projection.visibility.showNominationsBeforeSubmit ? (
                    <input type="hidden" name="showNominationsBeforeSubmit" value="on" />
                ) : null}
                <Tabs
                    label="Session visibility"
                    variant="neutral"
                    items={(['during', 'after'] as const).map((period) => ({
                        id: period,
                        label: period === 'during' ? 'During Session' : 'After Session',
                        content: (
                            <fieldset className={styles.checks} disabled={!canEdit || isPending}>
                                <legend className="visually-hidden">
                                    {period === 'during'
                                        ? 'During Session visibility'
                                        : 'After Session visibility'}
                                </legend>
                                {visibilityOptions.map((option) => {
                                    const name = option[period];
                                    return (
                                        <label className={styles.check} key={name}>
                                            <span>{option.label}</span>
                                            <input
                                                type="checkbox"
                                                name={name}
                                                defaultChecked={projection.visibility[name]}
                                            />
                                        </label>
                                    );
                                })}
                            </fieldset>
                        ),
                    }))}
                />
                <SelectionScaleField
                    defaultMax={projection.club.selectionScaleMax}
                    disabled={!canEdit || isPending}
                    idPrefix="selection-scale"
                    min={projection.club.selectionScaleMin}
                />
                {projection.permissions.manageSettings ? (
                    <SaveRow isPending={isPending} state={state} />
                ) : null}
            </form>
        </section>
    );
}
