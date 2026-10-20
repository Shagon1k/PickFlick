import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
    movieDetailsSchema,
    movieExternalIdSchema,
    movieSearchResultsSchema,
    movieSummarySchema,
    type TMovieDetails,
    type TMovieExternalId,
    type TMovieMetadata,
    type TMovieSearchResults,
    type TMovieSource,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import {
    MovieProviderError,
    type TProviderRecord,
    type TProviderSearch,
} from './providers/movie-provider.js';

interface ICached<TData> {
    data: TData;
    fetchedAt: Date;
}

/**
 * Summary columns kept on the Movie row so nominations never read the JSON caches. Unknown
 * values stay undefined, so a sparse search result never erases a known title or year.
 */
function toSummaryColumns(data: Pick<TMovieMetadata, 'title' | 'originalTitle' | 'releaseYear'>) {
    return {
        title: data.title ?? data.originalTitle ?? undefined,
        releaseYear: data.releaseYear ?? undefined,
    };
}

@Injectable()
export class MoviesRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findExternalIds(movieId: string): Promise<{ externalIds: TMovieExternalId[] } | null> {
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

    // Cache rows outlive deploys: a row in an older shape counts as a miss and is refetched.
    async findCachedDetails(movieId: string, key: string): Promise<ICached<TMovieDetails> | null> {
        const row = await this.prisma.movieDetailsCache.findUnique({
            where: { movieId_key: { movieId, key } },
        });
        const parsed = row ? movieDetailsSchema.safeParse(row.data) : null;
        return row && parsed?.success ? { data: parsed.data, fetchedAt: row.fetchedAt } : null;
    }

    async findCachedSearch(key: string): Promise<ICached<TMovieSearchResults> | null> {
        const row = await this.prisma.movieSearchCache.findUnique({ where: { key } });
        const parsed = row ? movieSearchResultsSchema.safeParse(row.data) : null;
        return row && parsed?.success ? { data: parsed.data, fetchedAt: row.fetchedAt } : null;
    }

    async findCachedPoster(movieId: string, source: TMovieSource): Promise<string | null> {
        const row = await this.prisma.movieSearchCache.findFirst({
            where: {
                data: {
                    path: ['movies'],
                    array_contains: [{ id: movieId, provenance: [{ source }] }],
                },
            },
            orderBy: { fetchedAt: 'desc' },
        });
        const parsed = row ? movieSearchResultsSchema.safeParse(row.data) : null;
        return parsed?.success
            ? (parsed.data.movies.find((movie) => movie.id === movieId)?.posterUrl ?? null)
            : null;
    }

    async saveSearch(
        key: string,
        search: TProviderSearch,
        fetchedAt: Date,
    ): Promise<TMovieSearchResults> {
        return this.prisma.$transaction(async (transaction) => {
            await this.lock(transaction);
            const movies = new Map<string, TMovieSearchResults['movies'][number]>();
            for (const record of search.movies) {
                const id = await this.resolveMovie(transaction, record.externalIds, record.data);
                movies.set(
                    id,
                    movieSummarySchema
                        .strip()
                        .parse({ id, ...record.data, provenance: record.provenance }),
                );
            }
            const data = { ...search, movies: [...movies.values()] };
            await transaction.movieSearchCache.upsert({
                where: { key },
                create: { key, data, fetchedAt },
                update: { data, fetchedAt },
            });
            return data;
        });
    }

    async saveDetails(
        movieId: string,
        key: string,
        record: TProviderRecord,
        fetchedAt: Date,
    ): Promise<TMovieDetails> {
        return this.prisma.$transaction(async (transaction) => {
            await this.lock(transaction);
            await this.resolveMovie(transaction, record.externalIds, record.data, movieId);
            let similarMovieIds: string[] | null = null;
            if (record.similarExternalIds) {
                similarMovieIds = [];
                for (const ids of record.similarExternalIds)
                    similarMovieIds.push(await this.resolveMovie(transaction, ids));
            }
            const data: TMovieDetails = {
                id: movieId,
                ...record.data,
                provenance: record.provenance,
                similarMovieIds,
            };
            await transaction.movieDetailsCache.upsert({
                where: { movieId_key: { movieId, key } },
                create: { movieId, key, data, fetchedAt },
                update: { data, fetchedAt },
            });
            return data;
        });
    }

    private async lock(transaction: Prisma.TransactionClient) {
        // Catalog ingestion is small and bounded. Serialize multi-record batches to avoid
        // lock inversions when searches/related titles contain overlapping external IDs.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(160, 36)`;
    }

    /**
     * Finds or creates the Movie UUID for a set of external IDs. IDs that point at different
     * Movies, or a known source with a different ID, are an identity conflict.
     */
    private async resolveMovie(
        transaction: Prisma.TransactionClient,
        ids: TMovieExternalId[],
        summary?: Pick<TMovieMetadata, 'title' | 'originalTitle' | 'releaseYear'>,
        expectedId?: string,
    ): Promise<string> {
        if (!ids.length || new Set(ids.map((id) => id.source)).size !== ids.length)
            throw new MovieProviderError('IDENTITY_CONFLICT');
        const mappings = await transaction.movieExternalId.findMany({ where: { OR: ids } });
        const movieIds = new Set(mappings.map((mapping) => mapping.movieId));
        if (expectedId) movieIds.add(expectedId);
        if (movieIds.size > 1) throw new MovieProviderError('IDENTITY_CONFLICT');
        const movieId = [...movieIds][0] ?? randomUUID();
        const columns = summary ? toSummaryColumns(summary) : {};
        if (movieIds.size) {
            if (summary) await transaction.movie.update({ where: { id: movieId }, data: columns });
        } else {
            await transaction.movie.create({ data: { id: movieId, ...columns } });
        }
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
