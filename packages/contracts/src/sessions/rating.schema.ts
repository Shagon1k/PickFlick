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
    own: sessionRatingSchema.nullable(),
    results: z
        .strictObject({
            average: z.number().nullable(),
            entries: z.array(sessionRatingSchema.extend({ id: z.uuid(), author: z.string() })),
        })
        .nullable(),
});
export type TRating = z.infer<typeof ratingSchema>;
