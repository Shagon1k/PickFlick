'use server';

import {
    changeMemberRoleSchema,
    CLUB_AVATAR_MAX_BYTES,
    CLUB_AVATAR_MEDIA_TYPES,
    HTTP_STATUS,
    updateClubSettingsSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
    changeClubLifecycle,
    changeMemberRole,
    removeClubAvatar,
    removeClubMember,
    replaceClubAvatar,
    type TClubLifecycleAction,
    updateClubSettings,
} from '#api/clubs.server';
import { readClubValues } from '#components/clubs/club-form.validation';
import { ApiError } from '#lib/api.server';
import { readFormText } from '#lib/form-data';

import type { IClubActionState } from './action-state';
import { getClubFailureMessage } from './club-errors';

function next(
    previous: IClubActionState,
    status: 'error' | 'success',
    message: string,
): IClubActionState {
    return { status, message, revision: previous.revision + 1 };
}

/** Runs one Club request and turns any failure into recovery copy for the form. */
async function run(
    previous: IClubActionState,
    request: () => Promise<unknown>,
    successMessage: string,
): Promise<IClubActionState> {
    try {
        await request();
        return next(previous, 'success', successMessage);
    } catch (error) {
        return error instanceof ApiError
            ? next(previous, 'error', getClubFailureMessage(error.status, error.reason))
            : next(previous, 'error', getClubFailureMessage(HTTP_STATUS.SERVICE_UNAVAILABLE));
    }
}

const isChecked = (formData: FormData, name: string): boolean => formData.get(name) === 'on';

export async function updateClubSettingsAction(
    clubId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const values = readClubValues(formData);
    const parsed = updateClubSettingsSchema.safeParse({
        ...values,
        selectionScaleMin: Number(values.selectionScaleMin),
        selectionScaleMax: Number(values.selectionScaleMax),
        showNominationAuthors: isChecked(formData, 'showNominationAuthors'),
        showNominationsBeforeSubmit: isChecked(formData, 'showNominationsBeforeSubmit'),
        showVoteResults: isChecked(formData, 'showVoteResults'),
        showRatingResults: isChecked(formData, 'showRatingResults'),
        useMonochromeMedia: isChecked(formData, 'useMonochromeMedia'),
    });
    if (!parsed.success) {
        return next(previous, 'error', 'Review the Club name, description, and Selection scale.');
    }
    const result = await run(
        previous,
        () => updateClubSettings(clubId, parsed.data),
        'Club settings saved.',
    );
    revalidatePath(`/clubs/${clubId}`, 'layout');
    revalidatePath('/app');
    return result;
}

export async function changeClubMemberRoleAction(
    clubId: string,
    membershipId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const parsed = changeMemberRoleSchema.safeParse({ role: formData.get('role') });
    if (!parsed.success) {
        return next(previous, 'error', 'Choose Moderator or Member.');
    }
    const result = await run(
        previous,
        () => changeMemberRole(clubId, membershipId, parsed.data),
        'Member role updated.',
    );
    revalidatePath(`/clubs/${clubId}`, 'layout');
    return result;
}

export async function changeClubLifecycleAction(
    clubId: string,
    action: TClubLifecycleAction,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const confirmation = readFormText(formData, 'confirmation');
    const result = await run(
        previous,
        () => changeClubLifecycle(clubId, action, confirmation),
        action === 'archive' ? 'Club archived.' : 'Club reactivated.',
    );
    revalidatePath('/app');
    if (result.status === 'success' && (action === 'delete' || action === 'leave')) {
        redirect('/app');
    }
    revalidatePath(`/clubs/${clubId}`, 'layout');
    return result;
}

export async function uploadClubAvatarAction(
    clubId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const file = formData.get('avatar');
    if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > CLUB_AVATAR_MAX_BYTES ||
        !(CLUB_AVATAR_MEDIA_TYPES as readonly string[]).includes(file.type)
    ) {
        return next(previous, 'error', 'Choose a PNG, JPEG, or WebP image no larger than 512 KiB.');
    }
    const result = await run(
        previous,
        () => replaceClubAvatar(clubId, file),
        'Club avatar updated.',
    );
    revalidatePath(`/clubs/${clubId}`, 'layout');
    return result;
}

export async function removeClubAvatarAction(
    clubId: string,
    previous: IClubActionState,
): Promise<IClubActionState> {
    const result = await run(previous, () => removeClubAvatar(clubId), 'Club avatar removed.');
    revalidatePath(`/clubs/${clubId}`, 'layout');
    return result;
}

export async function removeClubMemberAction(
    clubId: string,
    membershipId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const result = await run(
        previous,
        () => removeClubMember(clubId, membershipId, readFormText(formData, 'confirmation')),
        'Member removed. Shared history is preserved.',
    );
    revalidatePath(`/clubs/${clubId}`, 'layout');
    return result;
}
