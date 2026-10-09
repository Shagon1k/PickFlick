import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    movieDetailsSchema,
    movieSearchSchema,
    tmdbIdSchema,
    type TMovieDetails,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
} from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import {
    canUseStale,
    type IMovieProvider,
    MOVIE_PROVIDER,
    MovieProviderError,
} from './movie-provider.js';
import { MoviesRepository } from './movies.repository.js';

@Injectable()
export class MoviesService {
    private readonly logger = new Logger(MoviesService.name);

    constructor(
        @Inject(MOVIE_PROVIDER) private readonly provider: IMovieProvider,
        private readonly repository: MoviesRepository,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async search(
        input: TMovieSearch,
        allowStale = false,
    ): Promise<TMovieResult<TMovieSearchResults>> {
        const parsed = movieSearchSchema.parse(input);
        const key = createHash('sha256')
            .update(JSON.stringify(['en-US', false, parsed.query, parsed.page]))
            .digest('hex');
        const cached = await this.repository.cachedSearch(key);
        if (cached && this.within(cached.fetchedAt, this.environment.tmdb.refreshHours)) {
            return { state: 'fresh', data: cached.data, fetchedAt: cached.fetchedAt.toISOString() };
        }
        const startedAt = new Date();
        let data: TMovieSearchResults;
        try {
            data = await this.provider.search(parsed);
        } catch (error) {
            const fallback = allowStale ? await this.repository.cachedSearch(key) : null;
            return this.failure(error, fallback, allowStale);
        }
        await this.repository.saveSearch(key, data, startedAt);
        const saved = await this.repository.cachedSearch(key);
        return saved
            ? { state: 'fresh', data: saved.data, fetchedAt: saved.fetchedAt.toISOString() }
            : { state: 'unavailable', reason: 'NOT_FOUND' };
    }

    async details(
        tmdbId: number,
        options: { allowStale?: boolean; forceRefresh?: boolean } = {},
    ): Promise<TMovieResult<TMovieDetails>> {
        tmdbIdSchema.parse(tmdbId);
        const cached = await this.repository.cachedDetails(tmdbId);
        if (
            !options.forceRefresh &&
            cached &&
            this.within(cached.fetchedAt, this.environment.tmdb.refreshHours)
        ) {
            return { state: 'fresh', data: cached.data, fetchedAt: cached.fetchedAt.toISOString() };
        }
        const startedAt = new Date();
        let data: TMovieDetails;
        try {
            data = movieDetailsSchema.parse(await this.provider.details(tmdbId));
        } catch (error) {
            if (error instanceof MovieProviderError && error.reason === 'NOT_FOUND') {
                await this.repository.markUnavailable(tmdbId, startedAt);
            }
            const fallback = options.allowStale
                ? await this.repository.cachedDetails(tmdbId)
                : null;
            return this.failure(error, fallback, options.allowStale ?? false);
        }
        await this.repository.saveDetails(data, startedAt);
        const saved = await this.repository.cachedDetails(tmdbId);
        return saved
            ? { state: 'fresh', data: saved.data, fetchedAt: saved.fetchedAt.toISOString() }
            : { state: 'unavailable', reason: 'NOT_FOUND' };
    }

    private failure<TData>(
        error: unknown,
        cached: { data: TData; fetchedAt: Date } | null,
        allowStale: boolean,
    ): TMovieResult<TData> {
        if (!(error instanceof MovieProviderError)) {
            throw error;
        }
        this.logger.warn({ event: 'movies.provider.unavailable', reason: error.reason });
        const retryAt = error.retryAt?.toISOString();
        if (
            allowStale &&
            canUseStale(error.reason) &&
            cached &&
            this.within(cached.fetchedAt, this.environment.tmdb.staleHours)
        ) {
            return {
                state: 'stale',
                data: cached.data,
                fetchedAt: cached.fetchedAt.toISOString(),
                reason: error.reason,
                retryAt,
            };
        }
        return { state: 'unavailable', reason: error.reason, retryAt };
    }

    private within(fetchedAt: Date, hours: number): boolean {
        const age = Date.now() - fetchedAt.getTime();
        return age >= 0 && age < hours * 3_600_000;
    }
}
