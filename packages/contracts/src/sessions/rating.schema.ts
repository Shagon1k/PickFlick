import { z } from 'zod';

import { ratingScoreSchema } from '../common/rating-scale.js';
import { multilineText, optionalText } from '../common/text.js';

export const SESSION_RATING_COMMENT_MAX_LENGTH = 2000;
export const submitRatingSchema = z.strictObject({
    score: ratingScoreSchema,
    comment: optionalText(multilineText(0, SESSION_RATING_COMMENT_MAX_LENGTH)),
});
export type TSubmitRating = z.infer<typeof submitRatingSchema>;

export const closeRatingSchema = z.strictObject({
    phaseVersion: z.int().positive(),
    confirmation: z.literal('CLOSE'),
});
export type TCloseRating = z.infer<typeof closeRatingSchema>;

const sessionRatingSchema = z.strictObject({
    score: ratingScoreSchema,
    comment: z.string().nullable(),
    submittedAt: z.iso.datetime().nullable(),
});
export const ratingSchema = z.strictObject({
    acceptedCount: z.int().nonnegative(),
    submittedCount: z.int().nonnegative(),
    receivedCount: z.int().nonnegative(),
    canSubmit: z.boolean(),
    canClose: z.boolean(),
    own: sessionRatingSchema
        .extend({
            author: z.string(),
            avatarUrl: z.string().nullable(),
        })
        .nullable(),
    results: z
        .strictObject({
            average: z.number().nullable(),
            /** Individual responses can be hidden while the Club average remains available. */
            entries: z
                .array(
                    sessionRatingSchema.extend({
                        id: z.uuid(),
                        author: z.string(),
                        avatarUrl: z.string().nullable(),
                        /** The viewer's response, labelled You and shown first in the list. */
                        isOwn: z.boolean(),
                    }),
                )
                .nullable(),
        })
        .nullable(),
});
export type TRating = z.infer<typeof ratingSchema>;
