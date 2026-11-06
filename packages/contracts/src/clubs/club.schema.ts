import { z } from 'zod';

import { multilineText, optionalText, singleLineText } from '../common/text.js';

export const CLUB_NAME_MIN_LENGTH = 3;
export const CLUB_NAME_MAX_LENGTH = 100;
export const CLUB_DESCRIPTION_MAX_LENGTH = 500;
export const CLUB_SELECTION_SCALE_CEILING = 10;
export const CLUB_AVATAR_MAX_BYTES = 512 * 1024;
export const CLUB_AVATAR_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type TClubAvatarMediaType = (typeof CLUB_AVATAR_MEDIA_TYPES)[number];

/** Selection scales start at 0 for new Clubs; Clubs created earlier may keep their stored 1. */
export const selectionScaleMinSchema = z.union([z.literal(0), z.literal(1)]);
export const selectionScaleMaxSchema = z.int().min(1).max(CLUB_SELECTION_SCALE_CEILING);

const clubDetailsShape = {
    name: singleLineText(CLUB_NAME_MIN_LENGTH, CLUB_NAME_MAX_LENGTH),
    description: optionalText(multilineText(1, CLUB_DESCRIPTION_MAX_LENGTH)),
    selectionScaleMin: selectionScaleMinSchema,
    selectionScaleMax: selectionScaleMaxSchema,
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

export const clubVisibilityShape = {
    showNominationAuthorsDuring: z.boolean(),
    showNominationAuthorsAfter: z.boolean(),
    showSelectionScoresDuring: z.boolean(),
    showSelectionScoresAfter: z.boolean(),
    showRatingsDuring: z.boolean(),
    showRatingsAfter: z.boolean(),
    showNominationsBeforeSubmit: z.boolean(),
};

/** Club Info saves the name and description; the avatar has its own endpoint. */
export const updateClubInfoSchema = z.strictObject({
    name: clubDetailsShape.name,
    description: clubDetailsShape.description,
});

/** Club Settings save the Selection scale and every visibility flag together. */
export const updateClubRulesSchema = z
    .strictObject({
        selectionScaleMin: clubDetailsShape.selectionScaleMin,
        selectionScaleMax: clubDetailsShape.selectionScaleMax,
        ...clubVisibilityShape,
    })
    .refine(scaleIsIncreasing.check, scaleIsIncreasing.issue);

/** Each settings card sends only its own fields, so one card's save never resets the other's. */
export const updateClubSettingsSchema = z.union([updateClubInfoSchema, updateClubRulesSchema]);

export const changeMemberRoleSchema = z.strictObject({
    role: z.enum(['MODERATOR', 'MEMBER']),
});

/** Typed confirmation for a destructive action: `ARCHIVE`, `LEAVE`, or the Club name to delete. */
export const confirmClubActionSchema = z.strictObject({
    confirmation: z.string().trim().min(1),
});

export type TCreateClubRequest = z.infer<typeof createClubSchema>;
export type TUpdateClubSettingsRequest = z.infer<typeof updateClubSettingsSchema>;
export type TUpdateClubRulesRequest = z.infer<typeof updateClubRulesSchema>;
export type TChangeMemberRoleRequest = z.infer<typeof changeMemberRoleSchema>;
export type TConfirmClubActionRequest = z.infer<typeof confirmClubActionSchema>;
