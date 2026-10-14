import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    type TMovieDetails,
    type TMovieDetailsResponse,
    type TMovieResult,
    type TMovieSearch,
    type TMovieSearchResults,
    type TNominationMovie,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { buildDetailsCacheKey, buildSearchCacheKey } from './catalog-cache-key.js';
import { MoviesRepository } from './movies.repository.js';
import {
    canUseStale,
    type IMovieProvider,
    MOVIE_PROVIDER,
    MovieProviderError,
} from './providers/movie-provider.js';

interface ICached<TData> {
    data: TData;
    fetchedAt: Date;
}

const HOUR_MS = 3_600_000;

/** Details with a source that failed during the last fetch are reported as partial. */
function toCachedResult<TData extends TMovieDetails | TMovieSearchResults>(
    cached: ICached<TData>,
): TMovieResult<TData> {
    const isPartial =
        'provenance' in cached.data && cached.data.provenance.some((source) => source.reason);
    return {
        state: isPartial ? 'partial' : 'fresh',
        data: cached.data,
        fetchedAt: cached.fetchedAt.toISOString(),
    };
}

/**
 * Catalog reads with one freshness rule: cached data younger than `refreshHours` is served as is;
 * older data is refetched, and on a transient provider error a caller that opts in receives the
 * cache as `stale` while it is younger than `staleHours`.
 */
@Injectable()
export class MoviesService {
    private readonly logger = new Logger(MoviesService.name);
    constructor(
        @Inject(MOVIE_PROVIDER) private readonly provider: IMovieProvider,
        private readonly repository: MoviesRepository,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async findSummaries(
        tx: Prisma.TransactionClient,
        ids: string[],
    ): Promise<Map<string, TNominationMovie>> {
        const movies = await tx.movie.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true, releaseYear: true },
        });
        const byId = new Map(movies.map((movie) => [movie.id, movie]));
        return new Map(
            ids.map((id) => [
                id,
                { id, title: byId.get(id)?.title ?? null, year: byId.get(id)?.releaseYear ?? null },
            ]),
        );
    }

    async search(
        input: TMovieSearch,
        shouldAllowStale = false,
    ): Promise<TMovieResult<TMovieSearchResults>> {
        const key = buildSearchCacheKey(this.environment.catalog.provider, input);
        const cached = await this.repository.findCachedSearch(key);
        if (cached && this.isFresh(cached)) return toCachedResult(cached);
        const fetchedAt = new Date();
        try {
            const data = await this.repository.saveSearch(
                key,
                await this.provider.search(input),
                fetchedAt,
            );
            return toCachedResult({ data, fetchedAt });
        } catch (error) {
            return this.toFailureResult(error, shouldAllowStale ? cached : null);
        }
    }

    async getDetailsResponse(movieId: string): Promise<TMovieDetailsResponse> {
        const result = await this.getDetails(movieId, { allowStale: true });
        const lookup =
            result.state === 'unavailable' ? null : await this.repository.findExternalIds(movieId);
        const imdb = lookup?.externalIds.find(({ source }) => source === 'imdb')?.externalId;
        return {
            result,
            links: { imdb: imdb ? `https://www.imdb.com/title/${imdb}/` : null },
        };
    }

    async getDetails(
        movieId: string,
        options: { allowStale?: boolean; forceRefresh?: boolean } = {},
    ): Promise<TMovieResult<TMovieDetails>> {
        const locale = this.environment.catalog.locale;
        const key = buildDetailsCacheKey(this.environment.catalog.provider, locale);
        const cached = await this.repository.findCachedDetails(movieId, key);
        if (!options.forceRefresh && cached && this.isFresh(cached)) return toCachedResult(cached);
        const lookup = await this.repository.findExternalIds(movieId);
        if (!lookup) return { state: 'unavailable', reason: 'NOT_FOUND' };
        const fetchedAt = new Date();
        try {
            const record = await this.provider.fetchDetails({ ...lookup, locale });
            const data = await this.repository.saveDetails(movieId, key, record, fetchedAt);
            return toCachedResult({ data, fetchedAt });
        } catch (error) {
            return this.toFailureResult(error, options.allowStale ? cached : null);
        }
    }

    private toFailureResult<TData>(
        error: unknown,
        cached: ICached<TData> | null,
    ): TMovieResult<TData> {
        if (!(error instanceof MovieProviderError)) throw error;
        this.logger.warn({
            event: 'movies.provider.unavailable',
            reason: error.reason,
            source: error.source,
        });
        const retryAt = error.retryAt?.toISOString();
        if (
            cached &&
            canUseStale(error.reason) &&
            this.isYoungerThan(cached, this.environment.catalog.staleHours)
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

    private isFresh(cached: { fetchedAt: Date }): boolean {
        return this.isYoungerThan(cached, this.environment.catalog.refreshHours);
    }

    /** A timestamp in the future is never trusted as fresh or stale-safe. */
    private isYoungerThan(cached: { fetchedAt: Date }, hours: number): boolean {
        const age = Date.now() - cached.fetchedAt.getTime();
        return age >= 0 && age < hours * HOUR_MS;
    }
}
