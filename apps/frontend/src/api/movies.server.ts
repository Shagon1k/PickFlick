import 'server-only';

import {
    movieDetailsResponseSchema,
    type TMovieDetailsResponse,
    type TMovieProviderReason,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
} from '@pickflick/contracts';

import { ApiError, apiRequest } from '@/lib/api.server';

export const searchMovies = (input: TMovieSearch): Promise<TMovieResult<TMovieSearchResults>> =>
    apiRequest('/movies/search', { method: 'POST', json: input });

function unavailable(reason: TMovieProviderReason): TMovieDetailsResponse {
    return { result: { state: 'unavailable', reason }, links: { imdb: null } };
}

/** Maps transport and server failures to an unavailable result; client errors such as 401 rethrow. */
function failureReason(error: unknown): TMovieProviderReason | null {
    if (error instanceof SyntaxError) return 'INVALID_RESPONSE';
    if (error instanceof ApiError) {
        if (error.status === 429) return 'RATE_LIMITED';
        return error.status >= 500 ? 'UNAVAILABLE' : null;
    }
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return error instanceof TypeError || timedOut ? 'UNAVAILABLE' : null;
}

export async function getMovieDetails(movieId: string): Promise<TMovieDetailsResponse> {
    let response: unknown;
    try {
        // Three provider calls can each use the configured 30s maximum, followed by image ingestion.
        response = await apiRequest<unknown>(`/movies/${movieId}`, { timeoutMs: 100_000 });
    } catch (error) {
        const reason = failureReason(error);
        if (!reason) throw error;
        return unavailable(reason);
    }
    const parsed = movieDetailsResponseSchema.safeParse(response);
    const wrongMovie =
        parsed.success &&
        parsed.data.result.state !== 'unavailable' &&
        parsed.data.result.data.id !== movieId;
    return parsed.success && !wrongMovie ? parsed.data : unavailable('INVALID_RESPONSE');
}
