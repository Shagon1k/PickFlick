'use server';

import { movieIdSchema, savePersonalRatingSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { savePersonalRating } from '#api/personal-rating.server';
import { getFailureMessage } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export async function savePersonalRatingAction(movieId: string, input: unknown) {
    const parsed = savePersonalRatingSchema.safeParse(input);
    if (!movieIdSchema.safeParse(movieId).success || !parsed.success)
        return { ok: false as const, message: 'Choose a rating from 1 to 10.' };
    try {
        await savePersonalRating(movieId, parsed.data);
        revalidatePath(`/movies/${movieId}`);
        return { ok: true as const };
    } catch (error) {
        return {
            ok: false as const,
            message: getFailureMessage(error, {
                request: 'Personal Rating',
                statuses: [
                    [
                        ACCESS_LOST_STATUSES,
                        'Your rating could not be saved. Refresh to check your access.',
                    ],
                ],
                fallback: 'We could not save your rating. Your selection is still here; try again.',
            }),
        };
    }
}
