import { z } from 'zod';

import { ratingScoreSchema } from '../common/rating-scale.js';

export const savePersonalRatingSchema = z.strictObject({ score: ratingScoreSchema });
export type TSavePersonalRating = z.infer<typeof savePersonalRatingSchema>;

export const personalMovieRatingSchema = z.strictObject({
    score: ratingScoreSchema,
    source: z.enum(['PERSONAL', 'SESSION']),
    updatedAt: z.iso.datetime(),
});
export type TPersonalMovieRating = z.infer<typeof personalMovieRatingSchema>;

export const personalRatingResponseSchema = z.strictObject({
    rating: personalMovieRatingSchema.nullable(),
});
export type TPersonalRatingResponse = z.infer<typeof personalRatingResponseSchema>;
