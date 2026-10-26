import {
    buildScreening,
    buildSelectionSnapshot,
} from '../../../../testing/achievement-fixtures.js';
import { buildPersonalAchievements } from '../personal-rules.js';

describe('buildPersonalAchievements', () => {
    const nomination = {
        id: '00000000-0000-4000-8000-000000000001',
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
                    selectionResult: buildSelectionSnapshot(),
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
        const { metrics, evidence } = buildPersonalAchievements(facts);
        expect(metrics).toEqual({
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
        expect(buildPersonalAchievements(facts)).toEqual({ metrics, evidence });
    });

    it('should deny hidden averages and ignore another user and unproven timestamps', () => {
        const facts = buildFacts();
        facts.sessions[0]!.club.memberships[0]!.role = 'MEMBER';
        facts.sessions[0]!.showRatingResults = false;
        facts.sessions[0]!.progressEvents = [];
        facts.sessions[0]!.scheduledAt = new Date('2026-10-01');
        const { metrics } = buildPersonalAchievements(facts);
        expect(metrics['hot-take']!).toBe(0);
        expect(metrics['early-bird']!).toBe(0);
        expect(metrics['night-owl']!).toBe(0);
        const { metrics: other } = buildPersonalAchievements({
            ...facts,
            userId: 'other',
            hasProfile: false,
            libraryMovieIds: [],
            acceptedInviteIds: [],
        });
        expect(other['first-vote']!).toBe(0);
        expect(other['taste-maker']!).toBe(0);
        expect(other['critic']!).toBe(0);
    });

    it('should break attendance streaks on unknown attendance and avoid imported wins', () => {
        const facts = buildFacts();
        facts.sessions[0]!.type = 'PAST';
        facts.sessions.push(
            buildScreening({ id: 'unknown', participants: [] }),
            buildScreening({ id: 'last' }),
        );
        expect(buildPersonalAchievements(facts).metrics['reliable-viewer']!).toBe(1);
        expect(buildPersonalAchievements(facts).metrics['taste-maker']!).toBe(0);
    });

    it.each(['2026-10-01T23:00:00.000Z', '2026-10-01T23:00:00.001Z'])(
        'should require a screening strictly after 23:00 for Night Owl: %s',
        (date) => {
            const facts = buildFacts();
            facts.sessions[0]!.scheduledAt = new Date(date);
            expect(buildPersonalAchievements(facts).metrics['night-owl']).toBe(
                Number(date.endsWith('001Z')),
            );
        },
    );

    it('should use inclusive join and exclusive departure dates for streaks', () => {
        const facts = buildFacts();
        const session = facts.sessions[0]!;
        session.club.memberships[0]!.joinedAt = session.scheduledAt!;
        expect(buildPersonalAchievements(facts).metrics['reliable-viewer']).toBe(1);
        session.club.memberships[0]!.leftAt = session.scheduledAt!;
        expect(buildPersonalAchievements(facts).metrics['reliable-viewer']).toBe(0);
    });
    it('should reset attendance streaks between Membership intervals while matching historical attendees by user', () => {
        const facts = buildFacts();
        const original = facts.sessions[0]!.club.memberships[0]!;
        const club = {
            memberships: [
                { ...original, leftAt: new Date('2026-10-04'), status: 'LEFT' as const },
                { ...original, id: 'rejoined', joinedAt: new Date('2026-10-05') },
            ],
        };
        facts.sessions = Array.from({ length: 6 }, (_, index) =>
            buildScreening({
                id: `screening-${index}`,
                scheduledAt: new Date(`2026-10-0${index + 1}T20:00Z`),
                club,
                participants: index === 3 ? [] : buildScreening().participants,
            }),
        );
        const { metrics } = buildPersonalAchievements(facts);
        expect(metrics['reliable-viewer']).toBe(3);
        expect(metrics['never-miss']).toBe(3);
        facts.sessions = Array.from({ length: 5 }, (_, index) =>
            buildScreening({
                id: `screening-${index}`,
                scheduledAt: new Date(`2026-10-0${index + 5}T20:00Z`),
                club,
            }),
        );
        expect(buildPersonalAchievements(facts).metrics['reliable-viewer']).toBe(5);
    });

    it('should retain the ballot-to-Session link needed to explain Early Bird after source removal', () => {
        const facts = buildFacts();
        const first = facts.sessions[0]!;
        const second = buildScreening({
            id: 'second',
            type: 'FULL_CYCLE',
            progressEvents: [{ createdAt: new Date('2026-10-01T17:00Z') }],
        });
        facts.sessions.push(second);
        const earned = buildPersonalAchievements(facts);
        second.selectionBallots = first.selectionBallots;
        first.selectionBallots = [];
        const late = buildPersonalAchievements(facts);
        expect(earned.metrics['early-bird']).toBe(1);
        expect(late.metrics['early-bird']).toBe(0);
        expect(earned.evidence).not.toEqual(late.evidence);
        const retained = structuredClone(earned.evidence);
        facts.sessions = [];
        const ballot = retained.ballots[0]!;
        const opening = retained.openings.find((session) => session.id === ballot.sessionId)!;
        expect(Date.parse(ballot.submittedAt) - Date.parse(opening.openedAt!)).toBe(
            3 * 60 * 60 * 1000,
        );
        expect(ballot.sessionId).toBe(first.id);
    });
});
