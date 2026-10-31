import { Injectable, NotFoundException } from '@nestjs/common';
import type { TSaveWatchlist, TWatchlistItem } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class WatchlistService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, movieId: string) {
        const item = await this.prisma.watchlistItem.findUnique({
            where: { userId_movieId: { userId, movieId } },
        });
        return item ? this.toResponse(item) : null;
    }

    async save(userId: string, movieId: string, input: TSaveWatchlist) {
        if (!(await this.prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } })))
            throw new NotFoundException();
        const item = await this.prisma.watchlistItem.upsert({
            where: { userId_movieId: { userId, movieId } },
            create: { userId, movieId, priority: input.priority },
            update: { priority: input.priority },
        });
        return this.toResponse(item);
    }

    async remove(userId: string, movieId: string) {
        await this.prisma.watchlistItem.deleteMany({ where: { userId, movieId } });
    }

    private toResponse(item: {
        movieId: string;
        priority: TWatchlistItem['priority'];
        addedAt: Date;
    }): TWatchlistItem {
        return {
            movieId: item.movieId,
            priority: item.priority,
            addedAt: item.addedAt.toISOString(),
        };
    }
}
