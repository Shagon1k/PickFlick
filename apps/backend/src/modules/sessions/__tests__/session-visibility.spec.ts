import type { IClubVisibility, TSessionPhase } from '@pickflick/contracts';

import {
    canViewNominationAuthors,
    canViewRatingResults,
    canViewSelectionScores,
} from '../session-visibility.js';

const PHASES: TSessionPhase[] = [
    'NOMINATION',
    'SELECTION',
    'WATCHING',
    'RATING',
    'COMPLETED',
    'CANCELLED',
];
const VISIBILITY_FIELDS = [
    'showNominationAuthorsDuring',
    'showNominationAuthorsAfter',
    'showSelectionScoresDuring',
    'showSelectionScoresAfter',
    'showRatingsDuring',
    'showRatingsAfter',
] as const;

function buildVisibility(mask: number): IClubVisibility {
    return {
        showNominationAuthorsDuring: Boolean(mask & 1),
        showNominationAuthorsAfter: Boolean(mask & 2),
        showSelectionScoresDuring: Boolean(mask & 4),
        showSelectionScoresAfter: Boolean(mask & 8),
        showRatingsDuring: Boolean(mask & 16),
        showRatingsAfter: Boolean(mask & 32),
        showNominationsBeforeSubmit: true,
    };
}

describe('Session visibility', () => {
    it.each(PHASES)('should apply the Club author flag in %s', (phase) => {
        for (let mask = 0; mask < 2 ** VISIBILITY_FIELDS.length; mask++) {
            const club = buildVisibility(mask);
            const canSee =
                phase === 'COMPLETED'
                    ? club.showNominationAuthorsAfter
                    : club.showNominationAuthorsDuring;
            expect(canViewNominationAuthors({ phase }, club)).toBe(phase !== 'CANCELLED' && canSee);
        }
    });

    it.each(PHASES)(
        'should apply the Club Selection flag and submission boundary in %s',
        (phase) => {
            for (let mask = 0; mask < 2 ** VISIBILITY_FIELDS.length; mask++) {
                const club = buildVisibility(mask);
                for (const hasSubmitted of [false, true]) {
                    const isDuring = ['SELECTION', 'WATCHING', 'RATING'].includes(phase);
                    const canSee =
                        phase === 'COMPLETED'
                            ? club.showSelectionScoresAfter
                            : isDuring && club.showSelectionScoresDuring && hasSubmitted;
                    expect(canViewSelectionScores({ phase }, club, hasSubmitted)).toBe(canSee);
                }
            }
        },
    );

    it.each(PHASES)('should apply the Club rating flag and submission boundary in %s', (phase) => {
        for (let mask = 0; mask < 2 ** VISIBILITY_FIELDS.length; mask++) {
            const club = buildVisibility(mask);
            for (const hasSubmitted of [false, true]) {
                const canSee =
                    phase === 'COMPLETED'
                        ? club.showRatingsAfter
                        : phase === 'RATING' && club.showRatingsDuring && hasSubmitted;
                expect(canViewRatingResults({ phase }, club, hasSubmitted)).toBe(canSee);
            }
        }
    });

    it('should ignore stored Session visibility when Club settings change', () => {
        const session = { phase: 'COMPLETED' as const, ...buildVisibility(63) };
        const club = buildVisibility(0);
        expect(canViewRatingResults(session, club, true)).toBe(false);
        expect(canViewSelectionScores(session, club, true)).toBe(false);
        expect(canViewNominationAuthors(session, club)).toBe(false);
        club.showRatingsAfter = true;
        expect(canViewRatingResults(session, club, false)).toBe(true);
        expect(session.showRatingsAfter).toBe(true);
    });
});
