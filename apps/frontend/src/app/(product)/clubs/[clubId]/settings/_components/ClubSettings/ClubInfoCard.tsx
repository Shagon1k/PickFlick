'use client';

import { type IClubSettings } from '@pickflick/contracts';
import { useActionState } from 'react';

import SelectionScaleField from '@/components/clubs/SelectionScaleField/SelectionScaleField';
import Textarea from '@/components/ui/Textarea/Textarea';
import TextInput from '@/components/ui/TextInput/TextInput';

import { initialClubActionState } from '../../action-state';
import { updateClubSettingsAction } from '../../actions';
import styles from '../../page.module.scss';
import { isWritable } from './club-settings';
import SaveRow from './SaveRow';
import StoredVisibility from './StoredVisibility';

export default function ClubInfoCard({ projection }: { projection: IClubSettings }) {
    const action = updateClubSettingsAction.bind(null, projection.club.id);
    const [state, formAction, isPending] = useActionState(action, initialClubActionState);
    const canEdit = isWritable(projection);
    return (
        <section aria-labelledby="club-info-title" className={styles.card}>
            <h2 id="club-info-title">Club Info</h2>
            <form action={formAction} className={styles.cardForm}>
                <StoredVisibility projection={projection} />
                <TextInput
                    defaultValue={projection.club.name}
                    disabled={!canEdit}
                    id="club-name"
                    label="Club name"
                    maxLength={100}
                    minLength={3}
                    name="name"
                    required
                />
                <Textarea
                    defaultValue={projection.club.description ?? ''}
                    disabled={!canEdit}
                    id="club-description"
                    label="Description"
                    maxLength={500}
                    name="description"
                    rows={3}
                />
                <SelectionScaleField
                    defaultMax={projection.club.selectionScaleMax}
                    disabled={!canEdit}
                    idPrefix="selection-scale"
                    min={projection.club.selectionScaleMin}
                />
                {projection.permissions.manageSettings ? (
                    <SaveRow disabled={!canEdit} pending={isPending} state={state} />
                ) : null}
            </form>
        </section>
    );
}
