import { Injectable } from '@nestjs/common';
import {
    CLUB_RATINGS_PAGE_SIZE,
    type TClubRatings,
    type TClubRatingsQuery,
} from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { MoviesService } from '../../movies/movies.service.js';
import { findMembership } from '../access/club-access.js';
import { getClubEntitlements } from '../access/club-tiers.js';
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
                if (getClubEntitlements(clubId).tier === 'FREE') return null;
                return readCompletedScreenings(tx, clubId, membership.role);
            },
            { isolationLevel: 'RepeatableRead' },
        );
        if (snapshot === null)
            return {
                analytics: 'BASIC',
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                pageSize: CLUB_RATINGS_PAGE_SIZE,
            };
        const metadata = await this.movies.getCachedMetadata(
            snapshot.flatMap((row) => (row.movieId ? [row.movieId] : [])),
        );
        return buildClubRatings(snapshot, metadata, query);
    }
}
