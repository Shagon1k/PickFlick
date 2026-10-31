import {
    buildScreening,
    buildSelectionSnapshot,
} from '../../../../testing/achievement-fixtures.js';
import { buildCanonicalDetails } from '../../../../testing/movie-fixtures.js';
import { buildClubAchievements } from '../club-rules.js';

describe('buildClubAchievements', () => {
    it('should evaluate every Club criterion from explicit recorded evidence', () => {
        const first = buildScreening();
        const second = buildScreening({
            id: 'session-2',
            scheduledAt: new Date('2026-10-01T23:45:00Z'),
        });
        const third = buildScreening({
            id: 'session-3',
            scheduledAt: new Date('2026-11-01T20:00:00Z'),
        });
        const selection = buildScreening({
            id: 'selection',
            type: 'FULL_CYCLE',
            phase: 'WATCHING',
            selectionResult: buildSelectionSnapshot(),
        });
        const { metrics, evidence } = buildClubAchievements([first, second, third, selection]);
        expect(Object.keys(metrics)).toHaveLength(15);
        expect(metrics).toEqual({
            'first-screening': 3,
            'full-house': 1,
            'critics-circle': 1,
            'cult-classic': 1,
            'perfect-split': 1,
            'double-feature': 2,
            'decade-tour': 1,
            'marathon-night': 240,
            'world-tour': 0,
            'first-ten': 3,
            'packed-calendar': 2,
            'shared-taste': 3,
            'genre-roulette': 1,
            'silent-era': 0,
            comeback: 1,
        });
        expect(evidence).toMatchObject({
            sessions: [{ id: 'session-1' }, { id: 'session-2' }, { id: 'session-3' }],
        });
        expect(buildClubAchievements([first, second, third, selection])).toEqual({
            metrics,
            evidence,
        });
    });

    it('should preserve partial evidence without inventing attendance, dates, ratings or metadata', () => {
        const partial = buildScreening({
            scheduledAt: null,
            movie: null,
            participants: [],
            ratings: [],
        });
        const { metrics } = buildClubAchievements([
            partial,
            buildScreening({ phase: 'CANCELLED' }),
            buildScreening({ phase: 'RATING' }),
        ]);
        expect(metrics['first-ten']).toBe(1);
        for (const key of [
            'full-house',
            'critics-circle',
            'cult-classic',
            'double-feature',
            'marathon-night',
            'decade-tour',
            'genre-roulette',
            'shared-taste',
            'packed-calendar',
            'comeback',
        ] as const)
            expect(metrics[key]).toBe(0);
        expect(buildClubAchievements([]).metrics['first-screening']).toBe(0);
    });

    it('should exclude date-only entries from evening rules and unknown attendance from Full House', () => {
        const session = buildScreening({
            scheduledAt: new Date('2026-10-01'),
            participants: [
                {
                    id: 'participant-1',
                    membershipId: 'member-1',
                    status: 'ACCEPTED',
                    attended: null,
                    membership: { userId: 'user-1' },
                },
            ],
        });
        const { metrics } = buildClubAchievements([session]);
        expect(metrics['full-house']).toBe(0);
        expect(metrics['double-feature']).toBe(0);
        expect(metrics['critics-circle']).toBe(1);
    });

    it('should ignore imported score matrices as Selection outcome evidence', () => {
        expect(
            buildClubAchievements([
                buildScreening({ selectionResult: { ranking: [{ total: 9 }, { total: 8 }] } }),
            ]).metrics['perfect-split'],
        ).toBe(0);
    });

    it('should match imported attendees to historical members across a rejoin', () => {
        const session = buildScreening();
        session.club.memberships[0]!.leftAt = new Date('2026-10-02');
        session.club.memberships[0]!.status = 'LEFT';
        session.club.memberships.push({
            ...session.club.memberships[0]!,
            id: 'rejoined',
            joinedAt: new Date('2026-10-03'),
            leftAt: null,
            status: 'ACTIVE',
        });
        session.participants[0]!.membershipId = 'rejoined';
        expect(buildClubAchievements([session]).metrics).toMatchObject({
            'full-house': 1,
            'critics-circle': 1,
        });
        session.participants[0]!.membership.userId = 'another-user';
        expect(buildClubAchievements([session]).metrics).toMatchObject({
            'full-house': 0,
            'critics-circle': 0,
        });
    });

    it('should count distinct production countries and releases strictly before 1930', () => {
        const first = buildScreening({
            movie: {
                releaseYear: 1929,
                details: [
                    {
                        data: {
                            ...buildCanonicalDetails(),
                            productionCountries: ['US', 'FR', 'DE'],
                        },
                    },
                ],
            },
        });
        const second = buildScreening({
            movie: {
                releaseYear: 1930,
                details: [
                    {
                        data: {
                            ...buildCanonicalDetails(),
                            productionCountries: ['FR', 'JP', 'IT'],
                        },
                    },
                ],
            },
        });
        expect(buildClubAchievements([first, second]).metrics).toMatchObject({
            'world-tour': 5,
            'silent-era': 1,
        });
        expect(buildClubAchievements([second]).metrics['silent-era']).toBe(0);
        second.phase = 'RATING';
        expect(buildClubAchievements([second]).metrics['world-tour']).toBe(0);
    });

    it('should retain old cached genre, decade and runtime evidence without production countries', () => {
        const oldDetails = Object.fromEntries(
            Object.entries(buildCanonicalDetails()).filter(
                ([key]) => key !== 'productionCountries',
            ),
        );
        const session = buildScreening({
            movie: { releaseYear: 1999, details: [{ data: oldDetails }] },
        });
        expect(buildClubAchievements([session]).metrics).toMatchObject({
            'world-tour': 0,
            'genre-roulette': 1,
            'decade-tour': 1,
            'marathon-night': 120,
        });
    });

    it('should ignore malformed frozen live snapshots without failing the read', () => {
        const session = buildScreening({
            type: 'FULL_CYCLE',
            selectionResult: { ranking: [{ total: 10 }, { total: 9 }] },
        });
        expect(buildClubAchievements([session])).toMatchObject({
            metrics: { 'perfect-split': 0 },
            evidence: { selections: [] },
        });
    });
});
