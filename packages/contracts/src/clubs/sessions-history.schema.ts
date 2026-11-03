import { z } from 'zod';

export const clubSessionsHistoryQuerySchema = z.strictObject({
    cursor: z.uuid().optional(),
});

export type TClubSessionsHistoryQuery = z.infer<typeof clubSessionsHistoryQuerySchema>;
