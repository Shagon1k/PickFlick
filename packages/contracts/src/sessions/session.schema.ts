import { z } from 'zod';

import { multilineText, optionalText, singleLineText } from '../common/text.js';

export const sessionDetailsSchema = z.strictObject({
    scheduledAt: z.iso.datetime(),
    location: singleLineText(1, 200),
    topic: optionalText(singleLineText(1, 200)),
    notes: optionalText(multilineText(1, 2000)),
    deadlineAt: z.iso.datetime().nullable(),
});

export const createSessionSchema = sessionDetailsSchema
    .extend({
        id: z.uuidv4(),
        type: z.enum(['FULL_CYCLE', 'PRE_SELECTED']),
        movieId: z.uuid().nullable(),
    })
    .superRefine((input, context) => {
        if ((input.type === 'PRE_SELECTED') !== Boolean(input.movieId)) {
            context.addIssue({
                code: 'custom',
                path: ['movieId'],
                message: 'Choose a Movie for a pre-selected Session only.',
            });
        }
        if (input.type === 'PRE_SELECTED' && input.deadlineAt) {
            context.addIssue({
                code: 'custom',
                path: ['deadlineAt'],
                message: 'Only full-cycle Sessions have a nomination deadline.',
            });
        }
    });
export type TCreateSession = z.infer<typeof createSessionSchema>;
export const updateSessionSchema = sessionDetailsSchema.extend({
    version: z.number().int().positive(),
});
export type TUpdateSession = z.infer<typeof updateSessionSchema>;
export const cancelSessionSchema = z.strictObject({
    version: z.number().int().positive(),
    confirmation: z.literal('CANCEL'),
});
export type TCancelSession = z.infer<typeof cancelSessionSchema>;

export const sessionSchema = z.strictObject({
    id: z.uuid(),
    clubId: z.uuid(),
    clubName: z.string(),
    type: z.enum(['FULL_CYCLE', 'PRE_SELECTED', 'PAST']),
    phase: z.enum(['NOMINATION', 'SELECTION', 'WATCHING', 'RATING', 'COMPLETED', 'CANCELLED']),
    scheduledAt: z.iso.datetime().nullable(),
    location: z.string().nullable(),
    topic: z.string().nullable(),
    notes: z.string().nullable(),
    deadlineAt: z.iso.datetime().nullable(),
    movieId: z.uuid().nullable(),
    version: z.number().int().positive(),
    canEdit: z.boolean(),
    canCancel: z.boolean(),
});
export type TSession = z.infer<typeof sessionSchema>;
