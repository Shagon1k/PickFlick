import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    movieDetailsSchema,
    movieExternalIdSchema,
    movieSearchResultsSchema,
    movieSummarySchema,
    type TMovieDetails,
    type TMovieExternalId,
    type TMovieSource,
    type TMovieSummary,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { lockKey } from '../../database/advisory-lock.js';
import { PrismaService } from '../../database/prisma.service.js';
import { withinCacheAge } from './movie-cache.js';
import {
    canUseStale,
    MovieProviderError,
    sourceSnapshotSchema,
    type TProviderRecord,
    type TProviderSearch,
} from './providers/movie-provider.js';

@Injectable()
export class MoviesRepository {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async lookup(movieId: string) {
        const movie = await this.prisma.movie.findUnique({
            where: { id: movieId },
            include: { externalIds: true },
        });
        return movie
            ? {
                  externalIds: movie.externalIds.map(({ source, externalId }) =>
                      movieExternalIdSchema.parse({ source, externalId }),
                  ),
              }
            : null;
    }
    async cachedSources(movieId: string, locale: string) {
        const rows = await this.prisma.movieSourceCache.findMany({ where: { movieId, locale } });
        return rows.flatMap((row) => {
            const parsed = sourceSnapshotSchema.safeParse(row.data);
            return parsed.success ? [parsed.data] : [];
        });
    }
    async cachedDetails(movieId: string, key: string) {
        const row = await this.prisma.movieDetailsCache.findUnique({
            where: { movieId_key: { movieId, key } },
        });
        if (!row) return null;
        const parsed = movieDetailsSchema.safeParse(row.data);
        return parsed.success && parsed.data.id === movieId
            ? inspectDetailsCache(
                  { data: parsed.data, fetchedAt: row.fetchedAt },
                  this.environment.catalog,
              )
            : null;
    }
    async cachedSearch(key: string) {
        const row = await this.prisma.movieSearchCache.findUnique({ where: { key } });
        if (!row) return null;
        const parsed = movieSearchResultsSchema.safeParse(row.data);
        return parsed.success ? { data: parsed.data, fetchedAt: row.fetchedAt } : null;
    }
    async saveSearch(key: string, input: TProviderSearch, fetchedAt: Date) {
        await this.prisma.$transaction(async (tx) => {
            await lockKey(tx, 'movie-catalog');
            const movies: TMovieSummary[] = [];
            for (const record of input.movies) {
                const id = await this.resolveMovie(tx, record.externalIds);
                await this.saveSummary(tx, id, record.data);
                movies.push(
                    movieSummarySchema
                        .strip()
                        .parse({ id, ...record.data, provenance: record.provenance }),
                );
            }
            const data = {
                ...input,
                movies: [...new Map(movies.map((movie) => [movie.id, movie])).values()],
            };
            await tx.movieSearchCache.upsert({
                where: { key },
                create: { key, data, fetchedAt },
                update: { data, fetchedAt },
            });
        });
    }
    async saveDetails(movieId: string, key: string, record: TProviderRecord, fetchedAt: Date) {
        await this.prisma.$transaction(async (tx) => {
            await lockKey(tx, 'movie-catalog');
            await this.resolveMovie(tx, record.externalIds, movieId);
            for (const removal of record.removals)
                await this.removeSource(tx, movieId, removal.source);
            for (const snapshot of record.snapshots) {
                const identity = { movieId, source: snapshot.source, locale: snapshot.locale };
                const data = { data: snapshot, fetchedAt: new Date(snapshot.fetchedAt) };
                await tx.movieSourceCache.upsert({
                    where: { movieId_source_locale: identity },
                    create: { ...identity, ...data },
                    update: data,
                });
            }
            const similarMovieIds: string[] | null = record.similarExternalIds === null ? null : [];
            if (similarMovieIds)
                for (const ids of record.similarExternalIds ?? [])
                    similarMovieIds.push(await this.resolveMovie(tx, ids));
            const details = movieDetailsSchema.parse({
                id: movieId,
                ...record.data,
                provenance: record.provenance,
                similarMovieIds,
            });
            // An aggregate projection expires with its oldest contributing source.
            const cachedAt = new Date(
                Math.min(
                    fetchedAt.getTime(),
                    ...record.snapshots.map((snapshot) => Date.parse(snapshot.fetchedAt)),
                ),
            );
            await this.saveSummary(tx, movieId, details);
            const data = { data: details, fetchedAt: cachedAt };
            await tx.movieDetailsCache.upsert({
                where: { movieId_key: { movieId, key } },
                create: { movieId, key, ...data },
                update: data,
            });
        });
    }
    async markUnavailable(movieId: string, source: TMovieSource) {
        await this.prisma.$transaction(async (tx) => {
            await lockKey(tx, 'movie-catalog');
            await this.removeSource(tx, movieId, source);
        });
    }
    private async removeSource(
        tx: Prisma.TransactionClient,
        movieId: string,
        source: TMovieSource,
    ) {
        await tx.movieSourceCache.deleteMany({ where: { movieId, source } });
        await tx.movieDetailsCache.deleteMany({ where: { movieId } });
        await tx.movieSearchCache.deleteMany({
            where: { data: { path: ['movies'], array_contains: [{ id: movieId }] } },
        });
    }
    private async saveSummary(
        tx: Prisma.TransactionClient,
        id: string,
        data: Pick<TMovieDetails, 'title' | 'originalTitle' | 'releaseYear'>,
    ) {
        await tx.movie.update({
            where: { id },
            data: { title: data.title ?? data.originalTitle, releaseYear: data.releaseYear },
        });
    }
    private async resolveMovie(
        tx: Prisma.TransactionClient,
        ids: TMovieExternalId[],
        expectedId?: string,
    ): Promise<string> {
        if (!ids.length || new Set(ids.map((id) => id.source)).size !== ids.length)
            throw new MovieProviderError('IDENTITY_CONFLICT');
        const mappings = await tx.movieExternalId.findMany({ where: { OR: ids } });
        const movieIds = new Set(mappings.map((mapping) => mapping.movieId));
        if (expectedId) movieIds.add(expectedId);
        if (movieIds.size > 1) throw new MovieProviderError('IDENTITY_CONFLICT');
        const movieId = [...movieIds][0] ?? randomUUID();
        if (!movieIds.size) await tx.movie.create({ data: { id: movieId } });
        const existing = await tx.movieExternalId.findMany({ where: { movieId } });
        for (const id of ids) {
            if (
                existing.some(
                    (mapping) =>
                        mapping.source === id.source && mapping.externalId !== id.externalId,
                )
            )
                throw new MovieProviderError('IDENTITY_CONFLICT');
            await tx.movieExternalId.upsert({
                where: { source_externalId: id },
                create: { ...id, movieId },
                update: {},
            });
        }
        return movieId;
    }
}

export function inspectDetailsCache(
    cached: { data: TMovieDetails; fetchedAt: Date },
    policy: { refreshHours: number; staleHours: number },
) {
    const sources = cached.data.provenance;
    const stale = sources.find(
        (source) => source.reason && source.fetchedAt && canUseStale(source.reason),
    );
    let state: 'fresh' | 'partial' | 'stale' = 'fresh';
    if (sources.some((source) => source.reason)) state = 'partial';
    if (stale) state = 'stale';
    return {
        ...cached,
        state,
        reason: stale?.reason ?? undefined,
        fresh:
            withinCacheAge(cached.fetchedAt, policy.refreshHours) &&
            sources.every((source) => !source.reason),
        staleAllowed: withinCacheAge(cached.fetchedAt, policy.staleHours),
    };
}
