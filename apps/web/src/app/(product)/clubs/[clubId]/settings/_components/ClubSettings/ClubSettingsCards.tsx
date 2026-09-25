'use client';

import { useActionState, useState } from 'react';

import { CLUB_AVATAR_MEDIA_TYPES, type IClubSettings } from '@pickflick/contracts';
import { Button, TextAreaField, TextField } from '@pickflick/ui';

import {
    removeClubAvatarAction,
    updateClubSettingsAction,
    uploadClubAvatarAction,
} from '../../actions';
import { initialClubActionState } from '../../action-state';
import styles from '../../settings.module.scss';
import { SelectionScaleField } from '@/components/clubs/SelectionScaleField/SelectionScaleField';

import {
    ActionStatus,
    isWritable,
    SaveRow,
    StoredClubInfo,
    StoredVisibility,
    visibilityOptions,
} from './club-settings-shared';

export function ClubInfoCard({ projection }: Readonly<{ projection: IClubSettings }>) {
    const action = updateClubSettingsAction.bind(null, projection.club.id);
    const [state, formAction, pending] = useActionState(action, initialClubActionState);
    const writable = isWritable(projection);
    return (
        <section aria-labelledby="club-info-title" className={styles.card}>
            <h2 id="club-info-title">Club Info</h2>
            <form action={formAction} className={styles.cardForm}>
                <StoredVisibility projection={projection} />
                <TextField
                    defaultValue={projection.club.name}
                    disabled={!writable}
                    id="club-name"
                    label="Club name"
                    maxLength={100}
                    minLength={3}
                    name="name"
                    required
                />
                <TextAreaField
                    defaultValue={projection.club.description ?? ''}
                    disabled={!writable}
                    id="club-description"
                    label="Description"
                    maxLength={500}
                    name="description"
                    rows={3}
                />
                <SelectionScaleField
                    defaultMax={projection.club.selectionScaleMax}
                    disabled={!writable}
                    idPrefix="selection-scale"
                    min={projection.club.selectionScaleMin}
                />
                {projection.permissions.manageSettings ? (
                    <SaveRow disabled={!writable} pending={pending} state={state} />
                ) : null}
            </form>
        </section>
    );
}

export function VisibilityCard({ projection }: Readonly<{ projection: IClubSettings }>) {
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
                    <legend className="pf-visually-hidden">Visibility and presentation</legend>
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

export function AvatarCard({ projection }: Readonly<{ projection: IClubSettings }>) {
    const upload = uploadClubAvatarAction.bind(null, projection.club.id);
    const remove = removeClubAvatarAction.bind(null, projection.club.id);
    const [uploadState, uploadAction, uploadPending] = useActionState(
        upload,
        initialClubActionState,
    );
    const [removeState, removeAction, removePending] = useActionState(
        remove,
        initialClubActionState,
    );
    const [latestAction, setLatestAction] = useState<'remove' | 'upload'>('upload');
    const writable = isWritable(projection);
    const state = latestAction === 'remove' ? removeState : uploadState;
    const avatarVersion = projection.club.avatarVersion
        ? `?v=${encodeURIComponent(projection.club.avatarVersion)}`
        : '';
    return (
        <section aria-labelledby="club-avatar-title" className={styles.card}>
            <h2 id="club-avatar-title">Club Avatar</h2>
            <div className={styles.avatarLayout}>
                <div className={styles.avatar}>
                    {projection.club.hasAvatar ? (
                        // The authenticated API route performs the membership check before streaming the image.
                        <img
                            alt={`${projection.club.name} avatar`}
                            src={`/api/clubs/${projection.club.id}/avatar${avatarVersion}`}
                        />
                    ) : (
                        <span aria-hidden="true">
                            {projection.club.name.slice(0, 2).toUpperCase()}
                        </span>
                    )}
                </div>
                {projection.permissions.manageSettings ? (
                    <div className={styles.stack}>
                        <form
                            action={uploadAction}
                            className={styles.inlineForm}
                            onSubmit={() => setLatestAction('upload')}
                        >
                            <label className={styles.fileLabel}>
                                <span className="pf-visually-hidden">Club avatar</span>
                                <input
                                    accept={CLUB_AVATAR_MEDIA_TYPES.join(',')}
                                    disabled={!writable}
                                    name="avatar"
                                    required
                                    type="file"
                                />
                            </label>
                            <Button
                                disabled={!writable}
                                loading={uploadPending}
                                size="small"
                                type="submit"
                            >
                                Upload
                            </Button>
                        </form>
                        {projection.club.hasAvatar ? (
                            <form action={removeAction} onSubmit={() => setLatestAction('remove')}>
                                <Button
                                    disabled={!writable}
                                    loading={removePending}
                                    size="small"
                                    type="submit"
                                    variant="secondary"
                                >
                                    Remove avatar
                                </Button>
                            </form>
                        ) : null}
                        <p className={styles.explanation}>
                            PNG, JPEG, or WebP. Maximum 512 KiB. Stored privately.
                        </p>
                        <ActionStatus state={state} />
                    </div>
                ) : (
                    <p className={styles.explanation}>Only the Club Admin can change the avatar.</p>
                )}
            </div>
        </section>
    );
}
