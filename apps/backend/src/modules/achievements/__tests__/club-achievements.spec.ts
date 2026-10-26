import { buildScreening } from '../../../testing/achievement-fixtures.js';
import { buildClubAchievements } from '../club-achievements.js';

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
            selectionResult: { ranking: [{ total: 10 }, { total: 9 }] },
        });
        const metrics = buildClubAchievements([first, second, third, selection]);
        expect(Object.keys(metrics)).toHaveLength(15);
        expect(
            Object.fromEntries(Object.entries(metrics).map(([key, metric]) => [key, metric.value])),
        ).toEqual({
            'first-screening': 3,
            'full-house': 1,
            'critics-circle': 1,
            'cult-classic': 1,
            'perfect-split': 1,
            'double-feature': 2,
            'decade-tour': 1,
            'marathon-night': 240,
            'world-tour': null,
            'first-ten': 3,
            'packed-calendar': 2,
            'shared-taste': 3,
            'genre-roulette': 1,
            'silent-era': null,
            comeback: 1,
        });
        expect(metrics['first-screening']!.evidence).toMatchObject({
            sessions: [{ id: 'session-1' }, { id: 'session-2' }, { id: 'session-3' }],
        });
        expect(buildClubAchievements([first, second, third, selection])).toEqual(metrics);
    });

    it('should preserve partial evidence without inventing attendance, dates, ratings or metadata', () => {
        const partial = buildScreening({
            scheduledAt: null,
            movie: null,
            participants: [],
            ratings: [],
        });
        const metrics = buildClubAchievements([
            partial,
            buildScreening({ phase: 'CANCELLED' }),
            buildScreening({ phase: 'RATING' }),
        ]);
        expect(metrics['first-ten']!.value).toBe(1);
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
        ])
            expect(metrics[key]!.value).toBe(0);
        expect(buildClubAchievements([])['first-screening']!.value).toBe(0);
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
        const metrics = buildClubAchievements([session]);
        expect(metrics['full-house']!.value).toBe(0);
        expect(metrics['double-feature']!.value).toBe(0);
        expect(metrics['critics-circle']!.value).toBe(1);
    });

    it('should ignore imported score matrices as Selection outcome evidence', () => {
        expect(
            buildClubAchievements([
                buildScreening({ selectionResult: { ranking: [{ total: 9 }, { total: 8 }] } }),
            ])['perfect-split']!.value,
        ).toBe(0);
    });
});
