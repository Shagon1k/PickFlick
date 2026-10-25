'use server';

import { movieIdSchema, watchlistPrioritySchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { removeWatchlistItem, saveWatchlistItem } from '#api/watchlist.server';
import { getFailureMessage } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export async function setWatchlistAction(movieId: string, priority: unknown) {
    const parsed = watchlistPrioritySchema.nullable().safeParse(priority);
    if (!movieIdSchema.safeParse(movieId).success || !parsed.success)
        return { ok: false as const, message: 'Choose Low, Medium or High priority.' };
    try {
        if (parsed.data === null) await removeWatchlistItem(movieId);
        else await saveWatchlistItem(movieId, { priority: parsed.data });
        revalidatePath(`/movies/${movieId}`);
        revalidatePath('/library');
        return { ok: true as const };
    } catch (error) {
        return {
            ok: false as const,
            message: getFailureMessage(error, {
                request: 'Watchlist',
                statuses: [
                    [
                        ACCESS_LOST_STATUSES,
                        'Your Watchlist could not be changed. Refresh to check your access.',
                    ],
                ],
                fallback: 'We could not update your Watchlist. Try again.',
            }),
        };
    }
}
