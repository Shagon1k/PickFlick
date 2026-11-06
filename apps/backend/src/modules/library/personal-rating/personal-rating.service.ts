import { Injectable, NotFoundException } from '@nestjs/common';
import type { TPersonalMovieRating, TSavePersonalRating } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class PersonalRatingService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, movieId: string): Promise<TPersonalMovieRating | null> {
        const rating = await this.prisma.personalMovieRating.findUnique({
            where: { userId_movieId: { userId, movieId } },
        });
        return rating ? this.toResponse(rating) : null;
    }

    async save(
        userId: string,
        movieId: string,
        input: TSavePersonalRating,
    ): Promise<TPersonalMovieRating> {
        if (!(await this.prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } })))
            throw new NotFoundException();
        const data = { score: input.score, source: 'PERSONAL' as const };
        const rating = await this.prisma.personalMovieRating.upsert({
            where: { userId_movieId: { userId, movieId } },
            create: { userId, movieId, ...data },
            update: data,
        });
        return this.toResponse(rating);
    }

    private toResponse(rating: { score: number; source: 'PERSONAL' | 'SESSION'; updatedAt: Date }) {
        return {
            score: rating.score,
            source: rating.source,
            updatedAt: rating.updatedAt.toISOString(),
        };
    }
}
