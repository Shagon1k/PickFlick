import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    movieIdSchema,
    movieSearchSchema,
    type TMovieDetails,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
} from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { MoviesRepository } from './movies.repository.js';
import {
    canUseStale,
    type IMovieProvider,
    MOVIE_PROVIDER,
    MovieProviderError,
    parseProviderRecord,
    parseProviderSearch,
    type TProviderRecord,
    type TProviderSearch,
} from './providers/movie-provider.js';

function fresh<TData>(cached: { data: TData; fetchedAt: Date }): TMovieResult<TData> {
    return { state: 'fresh', data: cached.data, fetchedAt: cached.fetchedAt.toISOString() };
}

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
        const key = this.cacheKey([parsed.locale, false, parsed.query, parsed.page]);
        const cached = await this.repository.cachedSearch(key);
        if (cached && this.within(cached.fetchedAt, this.environment.catalog.refreshHours))
            return fresh(cached);
        const startedAt = new Date();
        let data: TProviderSearch;
        try {
            data = parseProviderSearch(await this.provider.search(parsed));
        } catch (error) {
            return this.failure(
                error,
                allowStale ? await this.repository.cachedSearch(key) : null,
                allowStale,
            );
        }
        await this.repository.saveSearch(key, data, startedAt);
        const saved = await this.repository.cachedSearch(key);
        return saved ? fresh(saved) : { state: 'unavailable', reason: 'NOT_FOUND' };
    }
    async details(
        movieId: string,
        options: { allowStale?: boolean; forceRefresh?: boolean; locale?: 'en-US' } = {},
    ): Promise<TMovieResult<TMovieDetails>> {
        movieIdSchema.parse(movieId);
        const locale = options.locale ?? this.environment.catalog.locale;
        const key = this.cacheKey([locale]);
        const cached = await this.repository.cachedDetails(movieId, key);
        if (!options.forceRefresh && cached?.fresh) return fresh(cached);
        const lookup = await this.repository.lookup(movieId);
        if (!lookup) return { state: 'unavailable', reason: 'NOT_FOUND' };
        const startedAt = new Date();
        let data: TProviderRecord;
        try {
            data = parseProviderRecord(
                await this.provider.details({
                    ...lookup,
                    movieId,
                    locale,
                    allowStale: options.allowStale ?? false,
                    forceRefresh: options.forceRefresh ?? false,
                }),
            );
        } catch (error) {
            if (error instanceof MovieProviderError && error.reason === 'NOT_FOUND' && error.source)
                await this.repository.markUnavailable(movieId, error.source, startedAt);
            const fallback = options.allowStale
                ? await this.repository.cachedDetails(movieId, key)
                : null;
            const safeFallback = fallback?.staleAllowed ? fallback : null;
            return this.failure(error, safeFallback, options.allowStale ?? false);
        }
        await this.repository.saveDetails(movieId, key, data, startedAt);
        const saved = await this.repository.cachedDetails(movieId, key);
        return saved
            ? this.result(saved, options.allowStale ?? false)
            : { state: 'unavailable', reason: 'NOT_FOUND' };
    }
    private result(
        cached: NonNullable<Awaited<ReturnType<MoviesRepository['cachedDetails']>>>,
        allowStale = false,
    ): TMovieResult<TMovieDetails> {
        if (cached.state === 'stale' && (!allowStale || !cached.staleAllowed))
            return { state: 'unavailable', reason: cached.reason ?? 'UNAVAILABLE' };
        if (cached.state === 'stale')
            return {
                state: 'stale',
                data: cached.data,
                fetchedAt: cached.fetchedAt.toISOString(),
                reason: cached.reason ?? 'UNAVAILABLE',
            };
        return {
            state: cached.state,
            data: cached.data,
            fetchedAt: cached.fetchedAt.toISOString(),
        };
    }
    private failure<TData>(
        error: unknown,
        cached: { data: TData; fetchedAt: Date } | null,
        allowStale: boolean,
    ): TMovieResult<TData> {
        if (!(error instanceof MovieProviderError)) throw error;
        this.logger.warn({
            event: 'movies.provider.unavailable',
            reason: error.reason,
            source: error.source,
        });
        const retryAt = error.retryAt?.toISOString();
        if (
            allowStale &&
            canUseStale(error.reason) &&
            cached &&
            this.within(cached.fetchedAt, this.environment.catalog.staleHours)
        )
            return {
                state: 'stale',
                data: cached.data,
                fetchedAt: cached.fetchedAt.toISOString(),
                reason: error.reason,
                retryAt,
            };
        return { state: 'unavailable', reason: error.reason, retryAt };
    }
    private cacheKey(values: unknown[]) {
        return createHash('sha256')
            .update(JSON.stringify([this.provider.configurationKey, ...values]))
            .digest('hex');
    }
    private within(date: Date, hours: number) {
        const age = Date.now() - date.getTime();
        return age >= 0 && age < hours * 3600000;
    }
}
