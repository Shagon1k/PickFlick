import { z } from 'zod';

export const savePersonalRatingSchema = z.strictObject({ score: z.number().int().min(1).max(10) });
export type TSavePersonalRating = z.infer<typeof savePersonalRatingSchema>;

export const personalMovieRatingSchema = z.strictObject({
    score: z.number().int().min(1).max(10),
    source: z.enum(['PERSONAL', 'SESSION']),
    updatedAt: z.iso.datetime(),
});
export type TPersonalMovieRating = z.infer<typeof personalMovieRatingSchema>;

export const personalRatingResponseSchema = z.strictObject({
    rating: personalMovieRatingSchema.nullable(),
});
export type TPersonalRatingResponse = z.infer<typeof personalRatingResponseSchema>;
