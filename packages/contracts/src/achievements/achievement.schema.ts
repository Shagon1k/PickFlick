import { z } from 'zod';

export const achievementQuerySchema = z.strictObject({});
export const achievementSchema = z.object({
    key: z.string(),
    version: z.int().positive(),
    title: z.string(),
    description: z.string(),
    target: z.number().positive(),
    progress: z.number().nonnegative().nullable(),
    status: z.enum(['unlocked', 'in-progress', 'not-started']),
    awardedAt: z.iso.datetime().nullable(),
    explanation: z.string(),
});
export const achievementsSchema = z.object({ items: z.array(achievementSchema) });
export type TAchievement = z.infer<typeof achievementSchema>;
export type TAchievements = z.infer<typeof achievementsSchema>;
