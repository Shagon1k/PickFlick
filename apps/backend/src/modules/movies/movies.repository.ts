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
import { PrismaService } from '../../database/prisma.service.js';
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
                      sourceSnapshotSchema.shape.externalIds.element.parse({ source, externalId }),
                  ),
              }
            : null;
    }
    async cachedSources(movieId: string, locale: string) {
        const movie = await this.prisma.movie.findUnique({
            where: { id: movieId },
            include: { externalIds: true, sources: { where: { locale } } },
        });
        if (!movie) return [];
        return movie.sources.flatMap((row) => {
            const parsed = sourceSnapshotSchema.safeParse(row.data);
            const unavailableAt = movie.externalIds.find(
                (id) => id.source === row.source,
            )?.unavailableAt;
            return parsed.success &&
                parsed.data.source === row.source &&
                parsed.data.locale === locale &&
                parsed.data.fetchedAt === row.fetchedAt.toISOString() &&
                (!unavailableAt || unavailableAt < row.fetchedAt)
                ? [parsed.data]
                : [];
        });
    }
    async cachedDetails(movieId: string, key: string) {
        const row = await this.prisma.movieDetailsCache.findUnique({
            where: { movieId_key: { movieId, key } },
        });
        if (!row) return null;
        const parsed = movieDetailsSchema.safeParse(row.data);
        return parsed.success &&
            parsed.data.id === movieId &&
            (await this.available(this.prisma, parsed.data))
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
        if (
            !parsed.success ||
            new Set(parsed.data.movies.map((movie) => movie.id)).size !== parsed.data.movies.length
        )
            return null;
        for (const movie of parsed.data.movies)
            if (!(await this.available(this.prisma, movie))) return null;
        return { data: parsed.data, fetchedAt: row.fetchedAt };
    }
    async saveSearch(key: string, data: TProviderSearch, fetchedAt: Date) {
        await this.prisma.$transaction(async (transaction) => {
            await this.lock(transaction);
            const movies: TMovieSummary[] = [];
            for (const record of data.movies) {
                const id = await this.resolveMovie(transaction, record.externalIds);
                movies.push(
                    movieSummarySchema
                        .strip()
                        .parse({ id, ...record.data, provenance: record.provenance }),
                );
            }
            const result = {
                ...data,
                movies: [...new Map(movies.map((movie) => [movie.id, movie])).values()],
            };
            await transaction.$executeRaw`INSERT INTO "MovieSearchCache" ("key", "data", "fetchedAt")
                VALUES (${key}, ${JSON.stringify(result)}::jsonb, ${fetchedAt})
                ON CONFLICT ("key") DO UPDATE SET "data"=EXCLUDED."data", "fetchedAt"=EXCLUDED."fetchedAt"
                WHERE "MovieSearchCache"."fetchedAt" <= EXCLUDED."fetchedAt"`;
        });
    }
    async saveDetails(movieId: string, key: string, record: TProviderRecord, fetchedAt: Date) {
        await this.prisma.$transaction(async (transaction) => {
            await this.lock(transaction);
            await this.resolveMovie(transaction, record.externalIds, movieId);
            for (const removal of record.removals)
                await this.removeSource(
                    transaction,
                    movieId,
                    removal.source,
                    new Date(removal.attemptedAt),
                );
            for (const snapshot of record.snapshots) {
                // Each source has its own monotonic clock; a newer primary cannot renew enrichment.
                const at = new Date(snapshot.fetchedAt);
                await transaction.$executeRaw`INSERT INTO "MovieSourceCache" ("movieId","source","locale","data","fetchedAt")
                    VALUES (${movieId}::uuid, ${snapshot.source}, ${snapshot.locale}, ${JSON.stringify(snapshot)}::jsonb, ${at})
                    ON CONFLICT ("movieId","source","locale") DO UPDATE SET "data"=EXCLUDED."data", "fetchedAt"=EXCLUDED."fetchedAt"
                    WHERE "MovieSourceCache"."fetchedAt" <= EXCLUDED."fetchedAt"`;
                await transaction.$executeRaw`UPDATE "MovieExternalId" SET "unavailableAt"=NULL WHERE "movieId"=${movieId}::uuid AND "source"=${snapshot.source} AND "unavailableAt" < ${at}`;
            }
            const similarMovieIds: string[] | null = record.similarExternalIds === null ? null : [];
            if (similarMovieIds)
                for (const ids of record.similarExternalIds ?? [])
                    similarMovieIds.push(await this.resolveMovie(transaction, ids));
            const details = movieDetailsSchema.parse({
                id: movieId,
                ...record.data,
                provenance: record.provenance,
                similarMovieIds,
            });
            if (!(await this.available(transaction, details))) return;
            // An older response cannot replace any newer contributing source or its projection.
            const newer = await transaction.movieSourceCache.findMany({
                where: { movieId, locale: 'en-US' },
            });
            if (
                record.snapshots.some((snapshot) =>
                    newer.some(
                        (row) =>
                            row.source === snapshot.source &&
                            row.fetchedAt > new Date(snapshot.fetchedAt),
                    ),
                )
            )
                return;
            await transaction.$executeRaw`INSERT INTO "MovieDetailsCache" ("movieId","key","data","fetchedAt") VALUES (${movieId}::uuid,${key},${JSON.stringify(details)}::jsonb,${fetchedAt})
                ON CONFLICT ("movieId","key") DO UPDATE SET "data"=EXCLUDED."data", "fetchedAt"=EXCLUDED."fetchedAt"
                WHERE "MovieDetailsCache"."fetchedAt" <= EXCLUDED."fetchedAt"`;
        });
    }
    async markUnavailable(movieId: string, source: TMovieSource, at: Date) {
        await this.prisma.$transaction(async (transaction) => {
            await this.lock(transaction);
            await this.removeSource(transaction, movieId, source, at);
        });
    }
    private async removeSource(
        transaction: Prisma.TransactionClient,
        movieId: string,
        source: TMovieSource,
        at: Date,
    ) {
        await transaction.$executeRaw`UPDATE "MovieExternalId" SET "unavailableAt"=${at}
            WHERE "movieId"=${movieId}::uuid AND "source"=${source}
            AND ("unavailableAt" IS NULL OR "unavailableAt" <= ${at})
            AND NOT EXISTS (SELECT 1 FROM "MovieSourceCache" WHERE "movieId"=${movieId}::uuid AND "source"=${source} AND "fetchedAt" > ${at})`;
    }
    private async available(
        transaction: Pick<Prisma.TransactionClient, 'movieExternalId' | 'movie'>,
        movie: Pick<TMovieDetails, 'id' | 'provenance'>,
    ) {
        if (
            !(await transaction.movie.findUnique({ where: { id: movie.id }, select: { id: true } }))
        )
            return false;
        const removed = await transaction.movieExternalId.findMany({
            where: { movieId: movie.id, unavailableAt: { not: null } },
        });
        return !movie.provenance.some(
            (source) =>
                source.fetchedAt &&
                removed.some(
                    (id) =>
                        id.source === source.source &&
                        id.unavailableAt &&
                        id.unavailableAt >= new Date(source.fetchedAt ?? ''),
                ),
        );
    }
    private async lock(transaction: Prisma.TransactionClient) {
        // Catalog ingestion is small and bounded. Serialize multi-record batches to avoid
        // lock inversions when searches/related titles contain overlapping external IDs.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(160, 36)`;
    }
    private async resolveMovie(
        transaction: Prisma.TransactionClient,
        input: TMovieExternalId[],
        expectedId?: string,
    ): Promise<string> {
        const ids = input.map((id) => movieExternalIdSchema.parse(id));
        if (!ids.length || new Set(ids.map((id) => id.source)).size !== ids.length)
            throw new MovieProviderError('IDENTITY_CONFLICT');
        const mappings = await transaction.movieExternalId.findMany({ where: { OR: ids } });
        const movieIds = new Set(mappings.map((mapping) => mapping.movieId));
        if (expectedId) movieIds.add(expectedId);
        if (movieIds.size > 1) throw new MovieProviderError('IDENTITY_CONFLICT');
        const movieId = [...movieIds][0] ?? randomUUID();
        if (!movieIds.size) await transaction.movie.create({ data: { id: movieId } });
        const existing = await transaction.movieExternalId.findMany({ where: { movieId } });
        for (const id of ids) {
            if (
                existing.some(
                    (mapping) =>
                        mapping.source === id.source && mapping.externalId !== id.externalId,
                )
            )
                throw new MovieProviderError('IDENTITY_CONFLICT');
            await transaction.movieExternalId.upsert({
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
    const within = (date: Date, hours: number) => {
        const age = Date.now() - date.getTime();
        return age >= 0 && age < hours * 3600000;
    };
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
            within(cached.fetchedAt, policy.refreshHours) &&
            sources.every(
                (source) =>
                    !source.reason &&
                    source.fetchedAt &&
                    within(new Date(source.fetchedAt), policy.refreshHours),
            ),
        staleAllowed:
            within(cached.fetchedAt, policy.staleHours) &&
            sources.every(
                (source) =>
                    !source.fetchedAt || within(new Date(source.fetchedAt), policy.staleHours),
            ),
    };
}
