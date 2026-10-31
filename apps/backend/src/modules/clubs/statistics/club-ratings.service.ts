import { Injectable } from '@nestjs/common';
import { type TClubRatings, type TClubRatingsQuery } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { MoviesService } from '../../movies/movies.service.js';
import { findMembership } from '../access/club-access.js';
import { buildClubRatings } from './club-ratings.js';
import { readCompletedScreenings } from './completed-screenings.js';

@Injectable()
export class ClubRatingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly movies: MoviesService,
    ) {}

    async list(userId: string, clubId: string, query: TClubRatingsQuery): Promise<TClubRatings> {
        const snapshot = await this.prisma.$transaction(
            async (tx) => {
                const membership = await findMembership(tx, userId, clubId);
                return readCompletedScreenings(tx, clubId, membership.role);
            },
            { isolationLevel: 'RepeatableRead' },
        );
        const metadata = await this.movies.getCachedMetadata(
            snapshot.flatMap((row) => (row.movieId ? [row.movieId] : [])),
        );
        return buildClubRatings(snapshot, metadata, query);
    }
}
