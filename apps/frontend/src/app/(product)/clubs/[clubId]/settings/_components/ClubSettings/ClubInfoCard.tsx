'use client';

import {
    CLUB_DESCRIPTION_MAX_LENGTH,
    CLUB_NAME_MAX_LENGTH,
    CLUB_NAME_MIN_LENGTH,
    type IClubSettings,
} from '@pickflick/contracts';
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

const DESCRIPTION_ROWS = 3;

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
                    maxLength={CLUB_NAME_MAX_LENGTH}
                    minLength={CLUB_NAME_MIN_LENGTH}
                    name="name"
                    required
                />
                <Textarea
                    defaultValue={projection.club.description ?? ''}
                    disabled={!canEdit}
                    id="club-description"
                    label="Description"
                    maxLength={CLUB_DESCRIPTION_MAX_LENGTH}
                    name="description"
                    rows={DESCRIPTION_ROWS}
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
