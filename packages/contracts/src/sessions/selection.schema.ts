import { z } from 'zod';

import {
    CLUB_SELECTION_SCALE_CEILING,
    selectionScaleMaxSchema,
    selectionScaleMinSchema,
} from '../clubs/club.schema.js';
import { nominationMovieSchema } from './nomination.schema.js';
import { importedSelectionOutcomeSchema } from './past-selection.schema.js';

const selectionScoreSchema = z.strictObject({
    nominationId: z.uuid(),
    score: z.int().min(0).max(CLUB_SELECTION_SCALE_CEILING),
});
export const submitSelectionSchema = z.strictObject({
    scores: z.array(selectionScoreSchema).min(1),
});
export type TSubmitSelection = z.infer<typeof submitSelectionSchema>;

export const closeSelectionSchema = z.strictObject({
    phaseVersion: z.int().positive(),
    confirmation: z.literal('CLOSE'),
});
export type TCloseSelection = z.infer<typeof closeSelectionSchema>;

export const selectionReasonSchema = z.enum([
    'TOTAL',
    'MAXIMUM_COUNT',
    'SUPPORTER_COUNT',
    'NOMINATION_TIME',
    'PROVIDER_ID',
    'NOMINATION_ID',
    'ONLY_NOMINATION',
]);
export type TSelectionReason = z.infer<typeof selectionReasonSchema>;

export const liveSelectionOutcomeSchema = z.strictObject({
    source: z.literal('LIVE'),
    winner: nominationMovieSchema,
    author: z.string().nullable(),
    closedAt: z.iso.datetime(),
    closure: z.enum(['AUTOMATIC', 'MANUAL']),
    breakdown: z
        .strictObject({
            scaleMin: selectionScaleMinSchema,
            scaleMax: selectionScaleMaxSchema,
            ballotCount: z.int().nonnegative(),
            reason: selectionReasonSchema,
            ranking: z.array(
                z.strictObject({
                    id: z.uuid(),
                    movie: nominationMovieSchema,
                    author: z.string().nullable(),
                    total: z.int().nonnegative(),
                    maximumCount: z.int().nonnegative(),
                    supporterCount: z.int().nonnegative(),
                }),
            ),
        })
        .nullable(),
});
export type TLiveSelectionOutcome = z.infer<typeof liveSelectionOutcomeSchema>;
export const selectionOutcomeSchema = z.discriminatedUnion('source', [
    liveSelectionOutcomeSchema,
    importedSelectionOutcomeSchema,
]);
export type TSelectionOutcome = z.infer<typeof selectionOutcomeSchema>;

export const selectionSchema = z.strictObject({
    scaleMin: selectionScaleMinSchema,
    scaleMax: selectionScaleMaxSchema,
    acceptedCount: z.int().nonnegative(),
    submittedCount: z.int().nonnegative(),
    canSubmit: z.boolean(),
    submittedAt: z.iso.datetime().nullable(),
    nominations: z.array(
        z.strictObject({
            id: z.uuid(),
            movie: nominationMovieSchema,
            author: z.string().nullable(),
            ownScore: z.int().nullable(),
        }),
    ),
});
export type TSelection = z.infer<typeof selectionSchema>;
