'use server';

import {
    changeMemberRoleSchema,
    CLUB_AVATAR_MAX_BYTES,
    CLUB_AVATAR_MEDIA_TYPES,
    type TUpdateClubSettingsRequest,
    updateClubInfoSchema,
    updateClubRulesSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
    changeClubLifecycle,
    changeMemberRole,
    CLUB_LIFECYCLE_ACTIONS,
    removeClubAvatar,
    removeClubMember,
    replaceClubAvatar,
    type TClubLifecycleAction,
    updateClubSettings,
} from '#api/clubs.server';
import { getFailureMessage } from '#lib/action-failure';
import { readFormText } from '#lib/form-data';

import type { IClubActionState } from './club-action-state';
import { CLUB_FAILURE } from './club-errors';
import { visibilityNames } from './settings/_components/ClubSettings/club-settings';

function next(
    previous: IClubActionState,
    status: 'error' | 'success',
    message: string,
): IClubActionState {
    return { status, message, revision: previous.revision + 1 };
}

/**
 * Runs one Club request, turns any failure into recovery copy for the form, and refreshes every
 * Club Hub view either way, since a failed request may still have been applied.
 */
async function run(
    clubId: string,
    previous: IClubActionState,
    request: () => Promise<unknown>,
    successMessage: string,
): Promise<IClubActionState> {
    try {
        await request();
        return next(previous, 'success', successMessage);
    } catch (error) {
        return next(previous, 'error', getFailureMessage(error, CLUB_FAILURE));
    } finally {
        revalidatePath(`/clubs/${clubId}`, 'layout');
    }
}

const isChecked = (formData: FormData, name: string): boolean => formData.get(name) === 'on';

/** Saves one settings card; the Club Hub list and Session pages show what either card holds. */
async function saveSettings(
    clubId: string,
    previous: IClubActionState,
    input: TUpdateClubSettingsRequest,
): Promise<IClubActionState> {
    const result = await run(
        clubId,
        previous,
        () => updateClubSettings(clubId, input),
        'Club settings saved.',
    );
    revalidatePath('/app');
    revalidatePath('/sessions/[sessionId]', 'page');
    return result;
}

/** The Settings card saves the Selection scale and every visibility flag. */
export async function updateClubSettingsAction(
    clubId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const parsed = updateClubRulesSchema.safeParse({
        selectionScaleMin: Number(readFormText(formData, 'selectionScaleMin')),
        selectionScaleMax: Number(readFormText(formData, 'selectionScaleMax')),
        ...Object.fromEntries(visibilityNames.map((name) => [name, isChecked(formData, name)])),
    });
    if (!parsed.success) {
        return next(previous, 'error', 'Review the Selection scale.');
    }
    return saveSettings(clubId, previous, parsed.data);
}

const ROLE_FIELD = 'role:';
const roleChangesSchema = z.array(changeMemberRoleSchema.extend({ membershipId: z.uuid() })).min(1);

/** Saves every role the Manage Moderators draft changed, in order, stopping at the first failure. */
export async function changeClubMemberRolesAction(
    clubId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const parsed = roleChangesSchema.safeParse(
        [...formData.entries()]
            .filter(([name]) => name.startsWith(ROLE_FIELD))
            .map(([name, role]) => ({ membershipId: name.slice(ROLE_FIELD.length), role })),
    );
    if (!parsed.success) {
        return next(previous, 'error', 'Choose Moderator or Member.');
    }
    return run(
        clubId,
        previous,
        async () => {
            for (const { membershipId, role } of parsed.data) {
                await changeMemberRole(clubId, membershipId, { role });
            }
        },
        'Moderators saved.',
    );
}

export async function changeClubLifecycleAction(
    clubId: string,
    action: TClubLifecycleAction,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    // Server actions are public endpoints: the action becomes a backend path segment.
    if (!CLUB_LIFECYCLE_ACTIONS.includes(action)) {
        return next(previous, 'error', 'This Club action is not available.');
    }
    const confirmation = readFormText(formData, 'confirmation');
    const result = await run(
        clubId,
        previous,
        () => changeClubLifecycle(clubId, action, confirmation),
        action === 'archive' ? 'Club archived.' : 'Club reactivated.',
    );
    revalidatePath('/app');
    if (result.status === 'success' && (action === 'delete' || action === 'leave')) {
        redirect('/app');
    }
    return result;
}

/** Club Info saves its fields and, when one was chosen, the new avatar in one submission. */
export async function saveClubInfoAction(
    clubId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    const file = formData.get('avatar');
    const avatar = file instanceof File && file.size > 0 ? file : null;
    if (avatar && !isValidAvatar(avatar)) {
        return next(previous, 'error', 'Choose a PNG, JPEG, or WebP image no larger than 512 KiB.');
    }
    const parsed = updateClubInfoSchema.safeParse({
        name: readFormText(formData, 'name'),
        description: readFormText(formData, 'description'),
    });
    if (!parsed.success) {
        return next(previous, 'error', 'Review the Club name and description.');
    }
    const saved = await saveSettings(clubId, previous, parsed.data);
    if (!avatar || saved.status !== 'success') return saved;
    return run(
        clubId,
        saved,
        () => replaceClubAvatar(clubId, avatar),
        'Club settings and avatar saved.',
    );
}

function isValidAvatar(file: File): boolean {
    return (
        file.size <= CLUB_AVATAR_MAX_BYTES &&
        (CLUB_AVATAR_MEDIA_TYPES as readonly string[]).includes(file.type)
    );
}

export async function removeClubAvatarAction(
    clubId: string,
    previous: IClubActionState,
): Promise<IClubActionState> {
    return run(clubId, previous, () => removeClubAvatar(clubId), 'Club avatar removed.');
}

export async function removeClubMemberAction(
    clubId: string,
    membershipId: string,
    previous: IClubActionState,
    formData: FormData,
): Promise<IClubActionState> {
    return run(
        clubId,
        previous,
        () => removeClubMember(clubId, membershipId, readFormText(formData, 'confirmation')),
        'Member removed. Shared history is preserved.',
    );
}
