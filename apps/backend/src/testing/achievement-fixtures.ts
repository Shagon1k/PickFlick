import type { TAchievementSession } from '../modules/achievements/achievement-sources.js';
import { buildCanonicalDetails } from './movie-fixtures.js';

const REVIEW_LENGTH = 301;

export function buildScreening(overrides: Partial<TAchievementSession> = {}): TAchievementSession {
    return {
        id: 'session-1',
        clubId: 'club-1',
        type: 'PAST',
        phase: 'COMPLETED',
        scheduledAt: new Date('2026-10-01T23:30:00Z'),
        selectionResult: null,
        showRatingResults: true,
        club: {
            memberships: [
                {
                    id: 'member-1',
                    userId: 'user-1',
                    joinedAt: new Date('2020-01-01'),
                    leftAt: null,
                    role: 'ADMIN',
                    status: 'ACTIVE',
                },
            ],
        },
        participants: [
            {
                id: 'participant-1',
                membershipId: 'member-1',
                status: 'ACCEPTED',
                attended: true,
                membership: { userId: 'user-1' },
            },
        ],
        nominations: [],
        pastNominations: [],
        selectionBallots: [],
        progressEvents: [],
        ratings: [
            {
                id: 'rating-1',
                participantId: 'participant-1',
                score: 10,
                comment: 'a'.repeat(REVIEW_LENGTH),
            },
        ],
        movie: { releaseYear: 1999, details: [{ data: buildCanonicalDetails() }] },
        ...overrides,
    };
}
