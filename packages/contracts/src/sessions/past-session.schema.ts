import { z } from 'zod';

import { sessionDetailsSchema } from './session.schema.js';

export const createPastSessionSchema = sessionDetailsSchema
    .omit({ deadlineAt: true })
    .extend({
        submissionId: z.uuidv4(),
        scheduledAt: z.iso.datetime().refine((value) => new Date(value).getTime() <= Date.now(), {
            message: 'Choose a date in the past.',
        }),
        movieId: z.uuid(),
        attendees: z.array(
            z.strictObject({
                membershipId: z.uuid(),
                score: z.int().min(1).max(10).optional(),
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
        if (
            new Set(input.scoreMatrix.map((row) => row.membershipId)).size !==
            input.scoreMatrix.length
        )
            context.addIssue({
                code: 'custom',
                path: ['scoreMatrix'],
                message: 'Supply each participant row once.',
            });
        for (const [index, row] of input.scoreMatrix.entries()) {
            if (
                !input.attendees.some((attendee) => attendee.membershipId === row.membershipId) ||
                new Set(row.scores.map((cell) => cell.movieId)).size !== row.scores.length ||
                row.scores.some(
                    (cell) =>
                        !input.nominations.some(
                            (nomination) => nomination.movieId === cell.movieId,
                        ),
                )
            )
                context.addIssue({
                    code: 'custom',
                    path: ['scoreMatrix', index],
                    message: 'Use selected attendees and unique nominated Movies only.',
                });
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
