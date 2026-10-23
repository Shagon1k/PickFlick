import { z } from 'zod';

import { sessionDetailsSchema } from './session.schema.js';

export const createPastSessionSchema = sessionDetailsSchema
    .omit({ deadlineAt: true })
    .extend({
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
    })
    .refine(
        (input) =>
            new Set(input.attendees.map((row) => row.membershipId)).size === input.attendees.length,
        {
            path: ['attendees'],
            message: 'Select each attendee once.',
        },
    );
export type TCreatePastSession = z.infer<typeof createPastSessionSchema>;

export const pastSessionMembersSchema = z.array(
    z.strictObject({
        id: z.uuid(),
        displayName: z.string(),
        status: z.enum(['ACTIVE', 'LEFT', 'REMOVED']),
    }),
);
export type TPastSessionMembers = z.infer<typeof pastSessionMembersSchema>;
