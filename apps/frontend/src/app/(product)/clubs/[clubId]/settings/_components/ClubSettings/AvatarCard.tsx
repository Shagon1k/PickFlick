'use client';

import { CLUB_AVATAR_MEDIA_TYPES, type IClubSettings } from '@pickflick/contracts';
import { useActionState, useState } from 'react';

import Button from '@/components/ui/Button/Button';

import { initialClubActionState } from '../../action-state';
import { removeClubAvatarAction, uploadClubAvatarAction } from '../../actions';
import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';
import { isWritable } from './club-settings';

export default function AvatarCard({ projection }: { projection: IClubSettings }) {
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
                                <span className="visually-hidden">Club avatar</span>
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
