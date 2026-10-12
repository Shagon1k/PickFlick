import { z } from 'zod';

export const submitNominationSchema = z.strictObject({ movieId: z.uuid() });
export type TSubmitNomination = z.infer<typeof submitNominationSchema>;
export const closeNominationSchema = z.strictObject({
    version: z.number().int().positive(),
    confirmation: z.literal('CLOSE'),
});
export type TCloseNomination = z.infer<typeof closeNominationSchema>;
export const nominationMovieSchema = z.strictObject({
    id: z.uuid(),
    title: z.string().nullable(),
    year: z.number().int().nullable(),
});
export type TNominationMovie = z.infer<typeof nominationMovieSchema>;
export const nominationsSchema = z.strictObject({
    phase: z.enum(['NOMINATION', 'SELECTION', 'WATCHING', 'RATING', 'COMPLETED', 'CANCELLED']),
    version: z.number().int().positive(),
    acceptedCount: z.number().int().nonnegative(),
    nominatedCount: z.number().int().nonnegative(),
    canSubmit: z.boolean(),
    canClose: z.boolean(),
    hidden: z.boolean(),
    ownMovie: nominationMovieSchema.nullable(),
    nominations: z.array(
        z.strictObject({
            movie: nominationMovieSchema,
            author: z.string().nullable(),
        }),
    ),
    suggestions: z.array(nominationMovieSchema),
});
export type TNominations = z.infer<typeof nominationsSchema>;
