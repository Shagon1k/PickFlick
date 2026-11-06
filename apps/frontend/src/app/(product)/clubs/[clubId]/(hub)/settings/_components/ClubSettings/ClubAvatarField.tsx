'use client';

import { CLUB_AVATAR_MEDIA_TYPES, type IClubSettings } from '@pickflick/contracts';
import { type ReactNode, useEffect, useState } from 'react';

import type { IClubActionState } from '#app/(product)/clubs/[clubId]/(hub)/club-action-state';
import { getMonogram } from '#lib/format';

import styles from '../../page.module.scss';
import ActionStatus from './ActionStatus';

/** The avatar picks its own file; Club Info's Save Changes uploads it with the other fields. */
export default function ClubAvatarField({
    projection,
    disabled,
    removeAction,
    removeState,
    children,
}: {
    projection: IClubSettings;
    disabled: boolean;
    removeAction: (formData: FormData) => void;
    removeState: IClubActionState;
    /** The Club name field that shares the avatar's row. */
    children: ReactNode;
}) {
    const { club, permissions } = projection;
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        if (!preview) return;
        return () => URL.revokeObjectURL(preview);
    }, [preview]);
    const version = club.avatarVersion ? `?v=${encodeURIComponent(club.avatarVersion)}` : '';
    const stored = club.hasAvatar ? `/api/clubs/${club.id}/avatar${version}` : null;
    const image = preview ?? stored;
    const canRemove = permissions.manageSettings && club.hasAvatar && !preview;
    // The authenticated API route checks membership before streaming; the optimizer has no cookie.
    // eslint-disable-next-line @next/next/no-img-element -- see above
    const picture = image ? <img alt={`${club.name} avatar`} src={image} /> : null;
    const monogram = <span aria-hidden="true">{getMonogram(club.name)}</span>;
    const tile = permissions.manageSettings ? (
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
    );
    return (
        <>
            <div className={styles.identityRow}>
                {tile}
                <div className={styles.identityField}>{children}</div>
            </div>
            {preview || canRemove ? (
                <div className={styles.avatarMeta}>
                    {preview ? <small>New image chosen. Save Changes to upload it.</small> : null}
                    {canRemove ? (
                        <button
                            aria-label="Remove avatar"
                            className={styles.textButton}
                            disabled={disabled}
                            formAction={removeAction}
                            formNoValidate
                            type="submit"
                        >
                            Remove
                        </button>
                    ) : null}
                </div>
            ) : null}
            <ActionStatus state={removeState} />
        </>
    );
}
