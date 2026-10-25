import 'server-only';

import type {
    TPersonalMovieRating,
    TPersonalRatingResponse,
    TSavePersonalRating,
} from '@pickflick/contracts';

import { apiPath, requestApi } from '#lib/api.server';

export async function getPersonalRating(movieId: string) {
    const response = await requestApi<TPersonalRatingResponse>(
        apiPath`/movies/${movieId}/personal-rating`,
    );
    return response.rating;
}

export function savePersonalRating(movieId: string, input: TSavePersonalRating) {
    return requestApi<TPersonalMovieRating>(apiPath`/movies/${movieId}/personal-rating`, {
        method: 'PUT',
        json: input,
    });
}
