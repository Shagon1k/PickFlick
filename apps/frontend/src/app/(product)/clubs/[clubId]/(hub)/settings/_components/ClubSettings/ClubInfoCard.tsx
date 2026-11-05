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
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from '../../page.module.scss';
import ClubAvatarField from './ClubAvatarField';
import SaveRow from './SaveRow';
import StoredVisibility from './StoredVisibility';

const DESCRIPTION_ROWS = 3;

export default function ClubInfoCard({ projection }: { projection: IClubSettings }) {
    const save = saveClubInfoAction.bind(null, projection.club.id);
    const remove = removeClubAvatarAction.bind(null, projection.club.id);
    const [saveState, formAction, isSaving] = useActionState(save, initialClubActionState);
    const [removeState, removeAction, isRemoving] = useActionState(remove, initialClubActionState);
    const canEdit = projection.permissions.manageSettings;
    return (
        <section aria-labelledby="club-info-title" className={styles.card}>
            <div className={styles.cardTitle}>
                <h2 id="club-info-title">Club Info</h2>
                <InfoTip label="About Club Info">
                    Club images accept PNG, JPEG or WebP up to 512 KiB and are stored privately.
                    Admins can click the image and use Save Changes to upload a replacement.
                </InfoTip>
            </div>
            <form action={formAction} className={styles.cardForm}>
                <StoredVisibility projection={projection} />
                <input
                    type="hidden"
                    name="selectionScaleMin"
                    value={projection.club.selectionScaleMin}
                />
                <input
                    type="hidden"
                    name="selectionScaleMax"
                    value={projection.club.selectionScaleMax}
                />
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
                {projection.permissions.manageSettings ? (
                    <SaveRow isPending={isSaving} state={saveState} />
                ) : null}
            </form>
        </section>
    );
}
