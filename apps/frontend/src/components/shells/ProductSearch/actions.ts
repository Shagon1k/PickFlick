'use server';

import { movieSearchSchema } from '@pickflick/contracts';

import { searchMovies } from '@/api/movies.server';
import { ApiError } from '@/lib/api.server';

export async function searchMoviesAction(query: unknown) {
    const parsed = movieSearchSchema.safeParse({ query });
    if (!parsed.success) return { state: 'invalid' as const };
    try {
        return await searchMovies(parsed.data);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401)
            return { state: 'signed-out' as const };
        console.error('Movie search request failed.');
        return { state: 'error' as const };
    }
}
