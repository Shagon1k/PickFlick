import { Injectable } from '@nestjs/common';
import { RATINGS_CSV_HEADER, type TRatingsCsvResult } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { escapeCsvCell, parseRatingsCsv } from './ratings-csv.js';

@Injectable()
export class RatingsCsvService {
    constructor(private readonly prisma: PrismaService) {}

    async preview(userId: string, input: unknown): Promise<TRatingsCsvResult> {
        return this.prisma.$transaction((tx) => this.validate(tx, userId, input));
    }

    async import(userId: string, input: unknown): Promise<TRatingsCsvResult> {
        return this.prisma.$transaction(async (tx) => {
            const result = await this.validate(tx, userId, input);
            if (result.errors.length) return result;
            const entries = result.rows.map(({ movieId, rating }) => ({ movieId, rating }));
            // One statement makes concurrent retries atomic and leaves identical ratings untouched.
            await tx.$executeRaw`
                INSERT INTO "PersonalMovieRating" ("userId", "movieId", score, source, "updatedAt")
                SELECT ${userId}::uuid, entry."movieId"::uuid, entry.rating,
                       'PERSONAL'::"PersonalRatingSource", CURRENT_TIMESTAMP
                FROM jsonb_to_recordset(${JSON.stringify(entries)}::jsonb)
                     AS entry("movieId" text, rating integer)
                ORDER BY entry."movieId"
                ON CONFLICT ("userId", "movieId") DO UPDATE
                SET score = EXCLUDED.score, source = EXCLUDED.source, "updatedAt" = EXCLUDED."updatedAt"
                WHERE "PersonalMovieRating".score IS DISTINCT FROM EXCLUDED.score
            `;
            return { ...result, imported: true };
        });
    }

    async export(userId: string) {
        const ratings = await this.prisma.personalMovieRating.findMany({
            where: { userId },
            orderBy: { movieId: 'asc' },
            include: { movie: { select: { title: true } } },
        });
        const lines = ratings.map(({ movieId, movie, score }) =>
            ['1', movieId, movie.title ?? '', String(score)].map(escapeCsvCell).join(','),
        );
        return { csv: `${[RATINGS_CSV_HEADER, ...lines].join('\r\n')}\r\n`, count: ratings.length };
    }

    private async validate(
        tx: Prisma.TransactionClient,
        userId: string,
        input: unknown,
    ): Promise<TRatingsCsvResult> {
        const parsed = parseRatingsCsv(input);
        const ids = parsed.entries.map((entry) => entry.movieId);
        const movies = await tx.movie.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true },
        });
        const ratings = await tx.personalMovieRating.findMany({
            where: { userId, movieId: { in: ids } },
        });
        const moviesById = new Map(movies.map((movie) => [movie.id, movie]));
        const scores = new Map(ratings.map((rating) => [rating.movieId, rating.score]));
        const result: TRatingsCsvResult = {
            total: parsed.total,
            rows: [],
            errors: parsed.errors,
            imported: false,
        };
        for (const entry of parsed.entries) {
            const movie = moviesById.get(entry.movieId);
            if (!movie) {
                result.errors.push({
                    row: entry.row,
                    message:
                        'Movie ID is not in this catalog. Choose a known Movie ID; titles are never matched automatically.',
                });
                continue;
            }
            const currentRating = scores.get(entry.movieId) ?? null;
            result.rows.push({
                ...entry,
                name: movie.title ?? 'Untitled Movie',
                currentRating,
                action: getAction(currentRating, entry.rating),
            });
        }
        result.errors.sort((a, b) => a.row - b.row);
        return result;
    }
}

function getAction(current: number | null, rating: number) {
    if (current === null) return 'create';
    return current === rating ? 'unchanged' : 'update';
}
