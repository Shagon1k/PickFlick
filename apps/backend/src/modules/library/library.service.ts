import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    LIBRARY_PAGE_SIZE,
    movieDetailsSchema,
    type TLibrary,
    type TLibraryQuery,
    type TLibraryStatistics,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { buildDetailsCacheKey } from '../movies/catalog-cache-key.js';
import { buildLibraryStatistics } from './library-statistics.js';

function getPagination(
    total: number,
    requestedPage: number,
): Pick<TLibrary, 'page' | 'pages' | 'total' | 'pageSize'> {
    const pages = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
    return { total, pages, page: Math.min(requestedPage, pages), pageSize: LIBRARY_PAGE_SIZE };
}

@Injectable()
export class LibraryService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
    ) {}

    async getStatistics(userId: string): Promise<TLibraryStatistics> {
        const [ratings, watchlistCount] = await this.prisma.$transaction(
            [
                this.prisma.personalMovieRating.findMany({
                    where: { userId },
                    select: {
                        score: true,
                        updatedAt: true,
                        movie: {
                            select: {
                                details: {
                                    where: {
                                        key: buildDetailsCacheKey(
                                            this.environment.catalog.provider,
                                            this.environment.catalog.locale,
                                        ),
                                    },
                                    select: { data: true },
                                },
                            },
                        },
                    },
                }),
                this.prisma.watchlistItem.count({ where: { userId } }),
            ],
            { isolationLevel: 'RepeatableRead' },
        );
        return buildLibraryStatistics(ratings, watchlistCount);
    }

    async list(userId: string, query: TLibraryQuery): Promise<TLibrary> {
        const movieFilter: Prisma.MovieWhereInput | undefined = query.q
            ? { title: { contains: query.q.replaceAll(/[\\%_]/gu, '\\$&'), mode: 'insensitive' } }
            : undefined;
        const movie = {
            select: {
                title: true,
                releaseYear: true,
                details: {
                    where: {
                        key: buildDetailsCacheKey(
                            this.environment.catalog.provider,
                            this.environment.catalog.locale,
                        ),
                    },
                    select: { data: true },
                },
            },
        };
        // Count and rows share a snapshot, including when the last page shrinks after removal.
        return this.prisma.$transaction(
            async (transaction) => {
                if (query.tab === 'watchlist') {
                    const where: Prisma.WatchlistItemWhereInput = {
                        userId,
                        priority: query.priority || undefined,
                        movie: movieFilter,
                    };
                    const pagination = getPagination(
                        await transaction.watchlistItem.count({ where }),
                        query.page,
                    );
                    const orders: Record<
                        TLibraryQuery['sort'],
                        Prisma.WatchlistItemOrderByWithRelationInput[]
                    > = {
                        title: [{ movie: { title: { sort: 'asc', nulls: 'last' } } }],
                        year: [{ movie: { releaseYear: { sort: 'desc', nulls: 'last' } } }],
                        recent: [{ addedAt: 'desc' }],
                        default: [{ priority: 'desc' }, { addedAt: 'asc' }],
                    };
                    const orderBy: Prisma.WatchlistItemOrderByWithRelationInput[] = [
                        ...orders[query.sort],
                        { movieId: 'asc' },
                    ];
                    const items = await transaction.watchlistItem.findMany({
                        where,
                        orderBy,
                        include: { movie },
                        skip: (pagination.page - 1) * LIBRARY_PAGE_SIZE,
                        take: LIBRARY_PAGE_SIZE,
                    });
                    return {
                        tab: 'watchlist',
                        ...pagination,
                        items: items.map((item) => ({
                            ...this.toMovie(item),
                            priority: item.priority,
                            addedAt: item.addedAt.toISOString(),
                        })),
                    };
                }
                const where: Prisma.PersonalMovieRatingWhereInput = {
                    userId,
                    score: query.score ? Number(query.score) : undefined,
                    movie: movieFilter,
                };
                const pagination = getPagination(
                    await transaction.personalMovieRating.count({ where }),
                    query.page,
                );
                const orders: Record<
                    TLibraryQuery['sort'],
                    Prisma.PersonalMovieRatingOrderByWithRelationInput[]
                > = {
                    title: [{ movie: { title: { sort: 'asc', nulls: 'last' } } }],
                    year: [{ movie: { releaseYear: { sort: 'desc', nulls: 'last' } } }],
                    recent: [{ updatedAt: 'desc' }],
                    default: [{ score: 'desc' }, { updatedAt: 'desc' }],
                };
                const orderBy: Prisma.PersonalMovieRatingOrderByWithRelationInput[] = [
                    ...orders[query.sort],
                    { movieId: 'asc' },
                ];
                const items = await transaction.personalMovieRating.findMany({
                    where,
                    orderBy,
                    include: { movie },
                    skip: (pagination.page - 1) * LIBRARY_PAGE_SIZE,
                    take: LIBRARY_PAGE_SIZE,
                });
                return {
                    tab: 'my-ratings',
                    ...pagination,
                    items: items.map((item) => ({
                        ...this.toMovie(item),
                        score: item.score,
                        source: item.source,
                        updatedAt: item.updatedAt.toISOString(),
                    })),
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    private toMovie(item: {
        movieId: string;
        movie: {
            title: string | null;
            releaseYear: number | null;
            details: { data: Prisma.JsonValue }[];
        };
    }) {
        // Old cache shapes are misses, just as they are on Movie Details; Library never fetches providers.
        const details = movieDetailsSchema.safeParse(item.movie.details[0]?.data);
        return {
            movieId: item.movieId,
            title: item.movie.title,
            releaseYear: item.movie.releaseYear,
            genres: details.success ? (details.data.genres ?? []) : [],
        };
    }
}
