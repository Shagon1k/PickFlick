'use client';

import { CLUB_AVATAR_MEDIA_TYPES, type IClubSettings } from '@pickflick/contracts';
import { useEffect, useState } from 'react';

import InfoTip from '#components/ui/InfoTip/InfoTip';
import { getMonogram } from '#lib/format';

import type { IClubActionState } from '../../action-state';
import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

/** The avatar picks its own file; Club Info's Save Changes uploads it with the other fields. */
export default function ClubAvatarField({
    projection,
    disabled,
    removeAction,
    removeState,
}: {
    projection: IClubSettings;
    disabled: boolean;
    removeAction: (formData: FormData) => void;
    removeState: IClubActionState;
}) {
    const { club, permissions } = projection;
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
    const version = club.avatarVersion ? `?v=${encodeURIComponent(club.avatarVersion)}` : '';
    const stored = club.hasAvatar ? `/api/clubs/${club.id}/avatar${version}` : null;
    const image = preview ?? stored;
    // The authenticated API route checks membership before streaming; the optimizer has no cookie.
    // eslint-disable-next-line @next/next/no-img-element -- see above
    const picture = image ? <img alt={`${club.name} avatar`} src={image} /> : null;
    const monogram = <span aria-hidden="true">{getMonogram(club.name)}</span>;
    return (
        <div className={styles.avatarField}>
            {permissions.manageSettings ? (
                <label className={styles.avatar} data-editable={!disabled || undefined}>
                    {picture ?? monogram}
                    <input
                        aria-label="Club avatar"
                        accept={CLUB_AVATAR_MEDIA_TYPES.join(',')}
                        className="visually-hidden"
                        disabled={disabled}
                        name="avatar"
                        onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            setPreview(file ? URL.createObjectURL(file) : null);
                        }}
                        type="file"
                    />
                    <span aria-hidden="true" className={styles.avatarHint}>
                        Change
                    </span>
                </label>
            ) : (
                <div className={styles.avatar}>{picture ?? monogram}</div>
            )}
            <div className={styles.avatarMeta}>
                <span className={styles.avatarTitle}>
                    Club avatar
                    <InfoTip label="About the Club avatar">
                        PNG, JPEG or WebP up to 512 KiB, stored privately. Choose the image, then
                        Save Changes uploads it.
                    </InfoTip>
                </span>
                {preview ? <small>New image chosen. Save Changes to upload it.</small> : null}
                {permissions.manageSettings && club.hasAvatar && !preview ? (
                    <button
                        className={styles.textButton}
                        disabled={disabled}
                        formAction={removeAction}
                        formNoValidate
                        type="submit"
                    >
                        Remove avatar
                    </button>
                ) : null}
                <ActionStatus state={removeState} />
            </div>
        </div>
    );
}
