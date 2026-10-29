import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import {
    LIBRARY_PAGE_SIZE,
    type TLibrary,
    type TLibraryQuery,
    type TLibraryStatistics,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { readCachedDetails } from '../movies/cached-details.js';
import { buildConfiguredDetailsKey } from '../movies/catalog-cache-key.js';
import { buildLibraryStatistics } from './library-statistics.js';

type TSort = TLibraryQuery['sort'];

const WATCHLIST_ORDER: Record<TSort, Prisma.WatchlistItemOrderByWithRelationInput[]> = {
    title: [{ movie: { title: { sort: 'asc', nulls: 'last' } } }],
    year: [{ movie: { releaseYear: { sort: 'desc', nulls: 'last' } } }],
    recent: [{ addedAt: 'desc' }],
    default: [{ priority: 'desc' }, { addedAt: 'asc' }],
};

const RATINGS_ORDER: Record<TSort, Prisma.PersonalMovieRatingOrderByWithRelationInput[]> = {
    title: [{ movie: { title: { sort: 'asc', nulls: 'last' } } }],
    year: [{ movie: { releaseYear: { sort: 'desc', nulls: 'last' } } }],
    recent: [{ updatedAt: 'desc' }],
    default: [{ score: 'desc' }, { updatedAt: 'desc' }],
};

/** Clamps the requested page into range, so a list that shrank still answers its last page. */
function paginate(
    total: number,
    requestedPage: number,
): {
    pagination: Pick<TLibrary, 'page' | 'pages' | 'pageSize' | 'total'>;
    window: { skip: number; take: number };
} {
    const pages = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
    const page = Math.min(requestedPage, pages);
    return {
        pagination: { total, pages, page, pageSize: LIBRARY_PAGE_SIZE },
        window: { skip: (page - 1) * LIBRARY_PAGE_SIZE, take: LIBRARY_PAGE_SIZE },
    };
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
                        movie: { select: { details: this.selectDetails() } },
                    },
                }),
                this.prisma.watchlistItem.count({ where: { userId } }),
            ],
            { isolationLevel: 'RepeatableRead' },
        );
        return buildLibraryStatistics(ratings, watchlistCount);
    }

    /** Count and rows share a snapshot, including when the last page shrinks after a removal. */
    list(userId: string, query: TLibraryQuery): Promise<TLibrary> {
        return this.prisma.$transaction(
            (tx) =>
                query.tab === 'watchlist'
                    ? this.listWatchlist(tx, userId, query)
                    : this.listRatings(tx, userId, query),
            { isolationLevel: 'RepeatableRead' },
        );
    }

    private async listWatchlist(
        tx: Prisma.TransactionClient,
        userId: string,
        query: TLibraryQuery,
    ): Promise<TLibrary> {
        const where: Prisma.WatchlistItemWhereInput = {
            userId,
            priority: query.priority || undefined,
            movie: this.matchTitle(query.q),
        };
        const { pagination, window } = paginate(
            await tx.watchlistItem.count({ where }),
            query.page,
        );
        const items = await tx.watchlistItem.findMany({
            where,
            orderBy: [...WATCHLIST_ORDER[query.sort], { movieId: 'asc' }],
            include: { movie: this.selectMovie() },
            ...window,
        });
        return {
            tab: 'watchlist',
            ...pagination,
            items: items.map((item) => ({
                ...this.toMovieRow(item),
                priority: item.priority,
                addedAt: item.addedAt.toISOString(),
            })),
        };
    }

    private async listRatings(
        tx: Prisma.TransactionClient,
        userId: string,
        query: TLibraryQuery,
    ): Promise<TLibrary> {
        const where: Prisma.PersonalMovieRatingWhereInput = {
            userId,
            score: query.score ? Number(query.score) : undefined,
            movie: this.matchTitle(query.q),
        };
        const { pagination, window } = paginate(
            await tx.personalMovieRating.count({ where }),
            query.page,
        );
        const items = await tx.personalMovieRating.findMany({
            where,
            orderBy: [...RATINGS_ORDER[query.sort], { movieId: 'asc' }],
            include: { movie: this.selectMovie() },
            ...window,
        });
        return {
            tab: 'my-ratings',
            ...pagination,
            items: items.map((item) => ({
                ...this.toMovieRow(item),
                score: item.score,
                source: item.source,
                updatedAt: item.updatedAt.toISOString(),
            })),
        };
    }

    /** Case-insensitive title search; `%`, `_` and `\` in the query match literally. */
    private matchTitle(text: string): Prisma.MovieWhereInput | undefined {
        if (!text) return undefined;
        return {
            title: { contains: text.replaceAll(/[\\%_]/gu, '\\$&'), mode: 'insensitive' },
        };
    }

    private selectDetails() {
        return {
            where: { key: buildConfiguredDetailsKey(this.environment.catalog) },
            select: { data: true },
        };
    }

    private selectMovie() {
        return { select: { title: true, releaseYear: true, details: this.selectDetails() } };
    }

    // Library never fetches providers: a missing or old cache shape simply has no genres.
    private toMovieRow(item: {
        movieId: string;
        movie: {
            title: string | null;
            releaseYear: number | null;
            details: { data: Prisma.JsonValue }[];
        };
    }) {
        return {
            movieId: item.movieId,
            title: item.movie.title,
            releaseYear: item.movie.releaseYear,
            genres: readCachedDetails(item.movie.details[0])?.genres ?? [],
        };
    }
}
