import { z } from 'zod';

import { multilineText, optionalText, singleLineText } from '../common/text.js';
import { nominationsSchema } from './nomination.schema.js';
import { selectionSchema } from './selection.schema.js';

/** Phases that hold a Club's single active slot; Rating Sessions are non-blocking. */
export const BLOCKING_SESSION_PHASES = ['NOMINATION', 'SELECTION', 'WATCHING'] as const;
/** Phases in which a Session still accepts roster and participation changes. */
export const OPEN_SESSION_PHASES = [...BLOCKING_SESSION_PHASES, 'RATING'] as const;
export function isBlockingSessionPhase(phase: string | undefined): boolean {
    return BLOCKING_SESSION_PHASES.some((blocking) => blocking === phase);
}
export function isOpenSessionPhase(phase: string): boolean {
    return OPEN_SESSION_PHASES.some((open) => open === phase);
}

export const SESSION_LOCATION_MAX_LENGTH = 200;
export const SESSION_TOPIC_MAX_LENGTH = 200;
export const SESSION_NOTES_MAX_LENGTH = 2000;

export const sessionDetailsSchema = z.strictObject({
    scheduledAt: z.iso.datetime(),
    location: singleLineText(1, SESSION_LOCATION_MAX_LENGTH),
    topic: optionalText(singleLineText(1, SESSION_TOPIC_MAX_LENGTH)),
    notes: optionalText(multilineText(1, SESSION_NOTES_MAX_LENGTH)),
    deadlineAt: z.iso.datetime().nullable(),
});

export const createSessionSchema = sessionDetailsSchema
    .extend({
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
    phaseVersion: z.number().int().positive(),
    progressVersion: z.number().int().positive(),
    nominations: nominationsSchema.nullable(),
    selection: selectionSchema.nullable(),
    canEdit: z.boolean(),
    canCancel: z.boolean(),
});
export type TSession = z.infer<typeof sessionSchema>;

export const sessionProgressSchema = z.strictObject({ version: z.number().int().positive() });
export type TSessionProgress = z.infer<typeof sessionProgressSchema>;
