import 'server-only';

import {
    HTTP_STATUS,
    movieDetailsResponseSchema,
    type TMovieDetailsResponse,
    type TMovieProviderReason,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
} from '@pickflick/contracts';

import { ApiError, requestApi } from '@/lib/api.server';

// Details may wait on several slow providers in sequence before the API answers.
const DETAILS_TIMEOUT_MS = 100_000;

export const searchMovies = (input: TMovieSearch): Promise<TMovieResult<TMovieSearchResults>> =>
    requestApi('/movies/search', { method: 'POST', json: input });

function toUnavailableResponse(reason: TMovieProviderReason): TMovieDetailsResponse {
    return { result: { state: 'unavailable', reason }, links: { imdb: null } };
}

/** Maps transport and server failures to an unavailable result; client errors such as 401 rethrow. */
function getFailureReason(error: unknown): TMovieProviderReason | null {
    if (error instanceof SyntaxError) return 'INVALID_RESPONSE';
    if (error instanceof ApiError) {
        if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
        return error.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR ? 'UNAVAILABLE' : null;
    }
    const hasTimedOut =
        error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return error instanceof TypeError || hasTimedOut ? 'UNAVAILABLE' : null;
}

export async function getMovieDetails(movieId: string): Promise<TMovieDetailsResponse> {
    let response: unknown;
    try {
        // Three provider calls can each use the configured 30s maximum, followed by image ingestion.
        response = await requestApi<unknown>(`/movies/${movieId}`, {
            timeoutMs: DETAILS_TIMEOUT_MS,
        });
    } catch (error) {
        const reason = getFailureReason(error);
        if (!reason) throw error;
        return toUnavailableResponse(reason);
    }
    const parsed = movieDetailsResponseSchema.safeParse(response);
    const isWrongMovie =
        parsed.success &&
        parsed.data.result.state !== 'unavailable' &&
        parsed.data.result.data.id !== movieId;
    return parsed.success && !isWrongMovie
        ? parsed.data
        : toUnavailableResponse('INVALID_RESPONSE');
}
