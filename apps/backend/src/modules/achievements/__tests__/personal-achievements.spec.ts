import { buildScreening } from '../../../testing/achievement-fixtures.js';
import { buildPersonalAchievements } from '../personal-achievements.js';

describe('buildPersonalAchievements', () => {
    const nomination = {
        id: 'nomination-1',
        movieId: 'movie-1',
        participant: { membership: { userId: 'user-1' } },
        movie: buildScreening().movie!,
    };
    function buildFacts() {
        return {
            userId: 'user-1',
            hasProfile: true,
            libraryMovieIds: ['movie-1', 'movie-1', 'movie-2'],
            acceptedInviteIds: ['invite-1'],
            sessions: [
                buildScreening({
                    type: 'FULL_CYCLE',
                    nominations: [nomination],
                    selectionResult: { winnerNominationId: 'nomination-1' },
                    selectionBallots: [
                        {
                            id: 'ballot-1',
                            participantId: 'participant-1',
                            submittedAt: new Date('2026-10-01T21:00Z'),
                        },
                    ],
                    progressEvents: [{ createdAt: new Date('2026-10-01T18:00Z') }],
                    ratings: [
                        {
                            id: 'rating-1',
                            participantId: 'participant-1',
                            score: 10,
                            comment: 'a'.repeat(301),
                        },
                        { id: 'rating-2', participantId: 'other', score: 2, comment: null },
                    ],
                }),
            ],
        };
    }
    it('should evaluate every personal criterion using only attributable evidence', () => {
        const facts = buildFacts();
        const metrics = buildPersonalAchievements(facts);
        expect(
            Object.fromEntries(Object.entries(metrics).map(([key, metric]) => [key, metric.value])),
        ).toEqual({
            'opening-credits': 1,
            'first-vote': 1,
            'reliable-viewer': 1,
            critic: 1,
            'panda-patron': 1,
            nominator: 1,
            'never-miss': 1,
            'taste-maker': 1,
            'genre-scout': 1,
            archivist: 2,
            'long-review': 301,
            'night-owl': 1,
            'early-bird': 1,
            'hot-take': 1,
        });
        expect(JSON.stringify(metrics)).not.toContain('a'.repeat(301));
        expect(buildPersonalAchievements(facts)).toEqual(metrics);
    });

    it('should deny hidden averages and ignore another user and unproven timestamps', () => {
        const facts = buildFacts();
        facts.sessions[0]!.club.memberships[0]!.role = 'MEMBER';
        facts.sessions[0]!.showRatingResults = false;
        facts.sessions[0]!.progressEvents = [];
        facts.sessions[0]!.scheduledAt = new Date('2026-10-01');
        const metrics = buildPersonalAchievements(facts);
        expect(metrics['hot-take']!.value).toBe(0);
        expect(metrics['early-bird']!.value).toBe(0);
        expect(metrics['night-owl']!.value).toBe(0);
        const other = buildPersonalAchievements({
            ...facts,
            userId: 'other',
            hasProfile: false,
            libraryMovieIds: [],
            acceptedInviteIds: [],
        });
        expect(other['first-vote']!.value).toBe(0);
        expect(other['taste-maker']!.value).toBe(0);
        expect(other['critic']!.value).toBe(0);
    });

    it('should break attendance streaks on unknown attendance and avoid imported wins', () => {
        const facts = buildFacts();
        facts.sessions[0]!.type = 'PAST';
        facts.sessions.push(
            buildScreening({ id: 'unknown', participants: [] }),
            buildScreening({ id: 'last' }),
        );
        expect(buildPersonalAchievements(facts)['reliable-viewer']!.value).toBe(1);
        expect(buildPersonalAchievements(facts)['taste-maker']!.value).toBe(0);
    });
});
