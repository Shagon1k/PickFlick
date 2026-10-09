import type {
    TMovieDetails,
    TMovieProviderReason,
    TMovieSearch,
    TMovieSearchResults,
} from '@pickflick/contracts';

export const MOVIE_PROVIDER = Symbol('MOVIE_PROVIDER');

export interface IMovieProvider {
    search(input: TMovieSearch): Promise<TMovieSearchResults>;
    details(tmdbId: number): Promise<TMovieDetails>;
}

export class MovieProviderError extends Error {
    constructor(
        public reason: TMovieProviderReason,
        public retryAt?: Date,
    ) {
        super(`Movie provider: ${reason}`);
    }
}

export function canUseStale(reason: TMovieProviderReason): boolean {
    return ['TIMEOUT', 'RATE_LIMITED', 'UNAVAILABLE'].includes(reason);
}
