import { z } from 'zod';

import { movieIdSchema } from './movie.schema.js';

export const watchlistPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type TWatchlistPriority = z.infer<typeof watchlistPrioritySchema>;

export const saveWatchlistSchema = z.strictObject({ priority: watchlistPrioritySchema });
export type TSaveWatchlist = z.infer<typeof saveWatchlistSchema>;

export const watchlistItemSchema = z.strictObject({
    movieId: movieIdSchema,
    priority: watchlistPrioritySchema,
    addedAt: z.iso.datetime(),
});
export type TWatchlistItem = z.infer<typeof watchlistItemSchema>;

export const watchlistResponseSchema = z.strictObject({ item: watchlistItemSchema.nullable() });
export type TWatchlistResponse = z.infer<typeof watchlistResponseSchema>;

export const watchlistSchema = z.strictObject({
    items: z.array(
        watchlistItemSchema.extend({
            title: z.string().nullable(),
            releaseYear: z.number().int().nullable(),
        }),
    ),
});
export type TWatchlist = z.infer<typeof watchlistSchema>;
