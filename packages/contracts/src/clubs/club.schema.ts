import { z } from 'zod';

import { multilineText, optionalText, singleLineText } from '../common/text.js';

export const CLUB_NAME_MIN_LENGTH = 3;
export const CLUB_NAME_MAX_LENGTH = 100;
export const CLUB_DESCRIPTION_MAX_LENGTH = 500;
export const CLUB_SELECTION_SCALE_CEILING = 10;
export const CLUB_AVATAR_MAX_BYTES = 512 * 1024;
export const CLUB_AVATAR_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type TClubAvatarMediaType = (typeof CLUB_AVATAR_MEDIA_TYPES)[number];

const clubDetailsShape = {
    name: singleLineText(CLUB_NAME_MIN_LENGTH, CLUB_NAME_MAX_LENGTH),
    description: optionalText(multilineText(1, CLUB_DESCRIPTION_MAX_LENGTH)),
    selectionScaleMin: z.union([z.literal(0), z.literal(1)]),
    selectionScaleMax: z.int().min(1).max(CLUB_SELECTION_SCALE_CEILING),
};

const scaleIsIncreasing = {
    check: (club: { selectionScaleMin: number; selectionScaleMax: number }) =>
        club.selectionScaleMax > club.selectionScaleMin,
    issue: {
        path: ['selectionScaleMax'],
        message: 'The final score must be greater than the first score.',
    },
};

export const createClubSchema = z
    .strictObject(clubDetailsShape)
    .refine(scaleIsIncreasing.check, scaleIsIncreasing.issue);

export const updateClubSettingsSchema = z
    .strictObject({
        ...clubDetailsShape,
        showNominationAuthors: z.boolean(),
        showNominationsBeforeSubmit: z.boolean(),
        showVoteResults: z.boolean(),
        showRatingResults: z.boolean(),
        useMonochromeMedia: z.boolean(),
    })
    .refine(scaleIsIncreasing.check, scaleIsIncreasing.issue);

export const changeMemberRoleSchema = z.strictObject({
    role: z.enum(['MODERATOR', 'MEMBER']),
});

/** Typed confirmation for a destructive action: `ARCHIVE`, `LEAVE`, or the Club name to delete. */
export const confirmClubActionSchema = z.strictObject({
    confirmation: z.string().trim().min(1),
});

export type TCreateClubRequest = z.infer<typeof createClubSchema>;
export type TUpdateClubSettingsRequest = z.infer<typeof updateClubSettingsSchema>;
export type TChangeMemberRoleRequest = z.infer<typeof changeMemberRoleSchema>;
export type TConfirmClubActionRequest = z.infer<typeof confirmClubActionSchema>;
