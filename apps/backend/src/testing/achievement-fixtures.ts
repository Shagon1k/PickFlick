import type { TAchievementSession } from '../modules/achievements/rules/rule-sources.js';
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

export function buildSelectionSnapshot() {
    const first = '00000000-0000-4000-8000-000000000001';
    const second = '00000000-0000-4000-8000-000000000002';
    return {
        movieId: first,
        winnerNominationId: first,
        closedAt: '2026-10-01T20:00:00.000Z',
        closure: { kind: 'AUTOMATIC' },
        reason: 'TOTAL',
        inputs: { scaleMin: 0, scaleMax: 10, ballots: [] },
        ranking: [
            { id: first, movieId: first, total: 10, maximumCount: 1, supporterCount: 1 },
            { id: second, movieId: second, total: 9, maximumCount: 0, supporterCount: 1 },
        ],
    };
}
