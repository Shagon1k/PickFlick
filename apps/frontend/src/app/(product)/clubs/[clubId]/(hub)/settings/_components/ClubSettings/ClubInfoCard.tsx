'use client';

import {
    CLUB_DESCRIPTION_MAX_LENGTH,
    CLUB_NAME_MAX_LENGTH,
    CLUB_NAME_MIN_LENGTH,
    type IClubSettings,
} from '@pickflick/contracts';
import { useActionState } from 'react';

import { initialClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import {
    removeClubAvatarAction,
    saveClubInfoAction,
} from '#app/(product)/clubs/[clubId]/(hub)/club-actions';
import SelectionScaleField from '#components/clubs/SelectionScaleField/SelectionScaleField';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from '../../page.module.scss';
import { isWritable } from './club-settings';
import ClubAvatarField from './ClubAvatarField';
import SaveRow from './SaveRow';
import StoredVisibility from './StoredVisibility';

const DESCRIPTION_ROWS = 3;

export default function ClubInfoCard({ projection }: { projection: IClubSettings }) {
    const save = saveClubInfoAction.bind(null, projection.club.id);
    const remove = removeClubAvatarAction.bind(null, projection.club.id);
    const [saveState, formAction, isSaving] = useActionState(save, initialClubActionState);
    const [removeState, removeAction, isRemoving] = useActionState(remove, initialClubActionState);
    const canEdit = isWritable(projection);
    return (
        <section aria-labelledby="club-info-title" className={styles.card}>
            <h2 id="club-info-title">Club Info</h2>
            <form action={formAction} className={styles.cardForm}>
                <StoredVisibility projection={projection} />
                <ClubAvatarField
                    // A saved or removed avatar clears the local preview.
                    key={`${saveState.revision}-${removeState.revision}`}
                    disabled={!canEdit || isSaving || isRemoving}
                    projection={projection}
                    removeAction={removeAction}
                    removeState={removeState}
                >
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
                </ClubAvatarField>
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
                    <SaveRow disabled={!canEdit} isPending={isSaving} state={saveState} />
                ) : null}
            </form>
        </section>
    );
}
