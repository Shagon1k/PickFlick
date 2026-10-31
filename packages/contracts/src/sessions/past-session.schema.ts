import { z } from 'zod';

import { ratingScoreSchema } from '../common/rating-scale.js';
import { sessionDetailsSchema } from './session.schema.js';

// UTC+14 is the first zone to start a calendar day, so its "today" may be tomorrow in UTC.
const FIRST_ZONE_LEAD_MS = 14 * 3_600_000;

export const createPastSessionSchema = sessionDetailsSchema
    .omit({ deadlineAt: true })
    .extend({
        submissionId: z.uuidv4(),
        scheduledAt: z.iso
            .datetime()
            .refine((value) => new Date(value).getTime() <= Date.now() + FIRST_ZONE_LEAD_MS, {
                message: 'Choose a date in the past.',
            }),
        movieId: z.uuid(),
        attendees: z.array(
            z.strictObject({
                membershipId: z.uuid(),
                score: ratingScoreSchema.optional(),
            }),
        ),
        nominations: z
            .array(
                z.strictObject({
                    movieId: z.uuid(),
                    nominatorMembershipId: z.uuid().optional(),
                }),
            )
            .default([]),
        scoreMatrix: z
            .array(
                z.strictObject({
                    membershipId: z.uuid(),
                    scores: z.array(
                        z.strictObject({ movieId: z.uuid(), score: z.int().min(0).max(10) }),
                    ),
                }),
            )
            .default([]),
    })
    .refine(
        (input) =>
            new Set(input.attendees.map((row) => row.membershipId)).size === input.attendees.length,
        {
            path: ['attendees'],
            message: 'Select each attendee once.',
        },
    )
    .superRefine((input, context) => {
        if (new Set(input.nominations.map((row) => row.movieId)).size !== input.nominations.length)
            context.addIssue({
                code: 'custom',
                path: ['nominations'],
                message: 'Add each nominated Movie once.',
            });
        // As in a live Session, each participant nominates one Movie.
        const nominators = input.nominations.flatMap((row) =>
            row.nominatorMembershipId ? [row.nominatorMembershipId] : [],
        );
        if (new Set(nominators).size !== nominators.length)
            context.addIssue({
                code: 'custom',
                path: ['nominations'],
                message: 'Choose each nominator for one Movie only.',
            });
        if (
            new Set(input.scoreMatrix.map((row) => row.membershipId)).size !==
            input.scoreMatrix.length
        )
            context.addIssue({
                code: 'custom',
                path: ['scoreMatrix'],
                message: 'Supply each participant row once.',
            });
        const attendeeIds = new Set(input.attendees.map((attendee) => attendee.membershipId));
        const nominatedIds = new Set(input.nominations.map((nomination) => nomination.movieId));
        for (const [index, row] of input.scoreMatrix.entries()) {
            const path = ['scoreMatrix', index];
            if (!attendeeIds.has(row.membershipId))
                context.addIssue({
                    code: 'custom',
                    path,
                    message: 'Score only selected attendees.',
                });
            if (new Set(row.scores.map((cell) => cell.movieId)).size !== row.scores.length)
                context.addIssue({ code: 'custom', path, message: 'Score each Movie once.' });
            if (row.scores.some((cell) => !nominatedIds.has(cell.movieId)))
                context.addIssue({ code: 'custom', path, message: 'Score only nominated Movies.' });
        }
    });
export type TCreatePastSession = z.infer<typeof createPastSessionSchema>;

export const pastSessionMembersSchema = z.array(
    z.strictObject({
        id: z.uuid(),
        displayName: z.string(),
        status: z.enum(['ACTIVE', 'LEFT', 'REMOVED']),
    }),
);
export type TPastSessionMembers = z.infer<typeof pastSessionMembersSchema>;
