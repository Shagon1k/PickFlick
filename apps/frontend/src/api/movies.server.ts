import 'server-only';

import {
    movieDetailsResponseSchema,
    type TMovieDetailsResponse,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
} from '@pickflick/contracts';

import { ApiError, apiRequest } from '@/lib/api.server';

export const searchMovies = (input: TMovieSearch): Promise<TMovieResult<TMovieSearchResults>> =>
    apiRequest('/movies/search', { method: 'POST', json: input });

export async function getMovieDetails(movieId: string): Promise<TMovieDetailsResponse> {
    try {
        // Three provider calls can each use the configured 30s maximum, followed by image ingestion.
        const response = await apiRequest<unknown>(`/movies/${movieId}`, { timeoutMs: 100_000 });
        const parsed = movieDetailsResponseSchema.safeParse(response);
        if (
            !parsed.success ||
            (parsed.data.result.state !== 'unavailable' && parsed.data.result.data.id !== movieId)
        )
            return {
                result: { state: 'unavailable', reason: 'INVALID_RESPONSE' },
                links: { imdb: null },
            };
        return parsed.data;
    } catch (error) {
        if (error instanceof SyntaxError)
            return {
                result: { state: 'unavailable', reason: 'INVALID_RESPONSE' },
                links: { imdb: null },
            };
        if (error instanceof ApiError && error.status === 429)
            return {
                result: { state: 'unavailable', reason: 'RATE_LIMITED' },
                links: { imdb: null },
            };
        if (
            (error instanceof ApiError && error.status >= 500) ||
            error instanceof TypeError ||
            (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        )
            return {
                result: { state: 'unavailable', reason: 'UNAVAILABLE' },
                links: { imdb: null },
            };
        throw error;
    }
}
