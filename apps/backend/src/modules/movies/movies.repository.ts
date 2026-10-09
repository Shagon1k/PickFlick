import { Injectable } from '@nestjs/common';
import {
    movieDetailsSchema,
    movieSearchResultsSchema,
    movieSummarySchema,
    type TMovieDetails,
    type TMovieSearchResults,
    type TMovieSummary,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class MoviesRepository {
    constructor(private readonly prisma: PrismaService) {}

    async cachedDetails(tmdbId: number) {
        const movie = await this.prisma.movie.findUnique({ where: { tmdbId } });
        if (!movie?.details || !movie.detailsFetchedAt || movie.unavailableAt) {
            return null;
        }
        const parsed = movieDetailsSchema.safeParse(movie.details);
        return parsed.success && parsed.data.tmdbId === tmdbId
            ? { data: parsed.data, fetchedAt: movie.detailsFetchedAt }
            : null;
    }

    async cachedSearch(key: string) {
        const cached = await this.prisma.movieSearchCache.findUnique({ where: { key } });
        if (!cached) {
            return null;
        }
        const parsed = movieSearchResultsSchema.safeParse(cached.data);
        if (!parsed.success) {
            return null;
        }
        const movieIds = [...new Set(parsed.data.movies.map(({ tmdbId }) => tmdbId))];
        if (movieIds.length !== parsed.data.movies.length) {
            return null;
        }
        const available = await this.prisma.movie.count({
            where: {
                tmdbId: { in: movieIds },
                unavailableAt: null,
            },
        });
        // A provider removal invalidates every cached search snapshot containing that Movie.
        return available === movieIds.length
            ? { data: parsed.data, fetchedAt: cached.fetchedAt }
            : null;
    }

    async saveSearch(key: string, data: TMovieSearchResults, fetchedAt: Date): Promise<void> {
        const parsed = movieSearchResultsSchema.parse(data);
        await this.prisma.$transaction(async (transaction) => {
            for (const movie of [...parsed.movies].sort((a, b) => a.tmdbId - b.tmdbId)) {
                await this.saveSummary(transaction, movie, fetchedAt);
            }
            await transaction.$executeRaw`
                INSERT INTO "MovieSearchCache" ("key", "data", "fetchedAt")
                VALUES (${key}, ${JSON.stringify(parsed)}::jsonb, ${fetchedAt})
                ON CONFLICT ("key") DO UPDATE SET
                    "data" = EXCLUDED."data", "fetchedAt" = EXCLUDED."fetchedAt"
                WHERE "MovieSearchCache"."fetchedAt" <= EXCLUDED."fetchedAt"`;
        });
    }

    async saveDetails(data: TMovieDetails, fetchedAt: Date): Promise<void> {
        const parsed = movieDetailsSchema.parse(data);
        const summary = movieSummarySchema.strip().parse(parsed);
        await this.prisma.$transaction(async (transaction) => {
            await this.saveSummary(transaction, summary, fetchedAt);
            await transaction.$executeRaw`
                UPDATE "Movie" SET "details" = ${JSON.stringify(parsed)}::jsonb,
                    "detailsFetchedAt" = ${fetchedAt}, "unavailableAt" = NULL
                WHERE "tmdbId" = ${parsed.tmdbId}
                    AND ("detailsFetchedAt" IS NULL OR "detailsFetchedAt" <= ${fetchedAt})
                    AND ("unavailableAt" IS NULL OR "unavailableAt" <= ${fetchedAt})`;
        });
    }

    async markUnavailable(tmdbId: number, observedAt: Date): Promise<void> {
        // Retain a tombstone even when removal races the first successful ingestion.
        await this.prisma.$executeRaw`
            INSERT INTO "Movie" ("tmdbId", "unavailableAt") VALUES (${tmdbId}, ${observedAt})
            ON CONFLICT ("tmdbId") DO UPDATE SET "unavailableAt" = EXCLUDED."unavailableAt"
            WHERE ("Movie"."detailsFetchedAt" IS NULL OR "Movie"."detailsFetchedAt" <= ${observedAt})
                AND ("Movie"."unavailableAt" IS NULL OR "Movie"."unavailableAt" <= ${observedAt})`;
    }

    private async saveSummary(
        transaction: Prisma.TransactionClient,
        movie: TMovieSummary,
        fetchedAt: Date,
    ): Promise<void> {
        await transaction.$executeRaw`
            INSERT INTO "Movie" ("tmdbId", "summary", "summaryFetchedAt")
            VALUES (${movie.tmdbId}, ${JSON.stringify(movie)}::jsonb, ${fetchedAt})
            ON CONFLICT ("tmdbId") DO UPDATE SET
                "summary" = EXCLUDED."summary", "summaryFetchedAt" = EXCLUDED."summaryFetchedAt"
            WHERE "Movie"."summaryFetchedAt" IS NULL
                OR "Movie"."summaryFetchedAt" <= EXCLUDED."summaryFetchedAt"`;
    }
}
