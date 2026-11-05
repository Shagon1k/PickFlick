import type { IClubVisibility, TSessionPhase } from '@pickflick/contracts';

import {
    canViewNominationAuthors,
    canViewRatingResults,
    canViewSelectionScores,
} from '../session-visibility.js';

const HIDDEN: IClubVisibility = {
    showNominationAuthorsDuring: false,
    showNominationAuthorsAfter: false,
    showSelectionScoresDuring: false,
    showSelectionScoresAfter: false,
    showRatingsDuring: false,
    showRatingsAfter: false,
    showNominationsBeforeSubmit: true,
};

function withFlags(flags: Partial<IClubVisibility>): IClubVisibility {
    return { ...HIDDEN, ...flags };
}

describe('Session visibility', () => {
    it.each<[TSessionPhase, Partial<IClubVisibility>, boolean]>([
        ['NOMINATION', { showNominationAuthorsDuring: true }, true],
        ['RATING', { showNominationAuthorsDuring: true }, true],
        ['RATING', { showNominationAuthorsAfter: true }, false],
        ['COMPLETED', { showNominationAuthorsAfter: true }, true],
        ['COMPLETED', { showNominationAuthorsDuring: true }, false],
        [
            'CANCELLED',
            { showNominationAuthorsDuring: true, showNominationAuthorsAfter: true },
            false,
        ],
    ])('should show nomination authors in %s with %o: %s', (phase, flags, canSee) => {
        expect(canViewNominationAuthors({ phase }, withFlags(flags))).toBe(canSee);
    });

    it.each<[TSessionPhase, Partial<IClubVisibility>, boolean, boolean]>([
        ['NOMINATION', { showSelectionScoresDuring: true }, true, false],
        ['SELECTION', { showSelectionScoresDuring: true }, true, true],
        ['SELECTION', { showSelectionScoresDuring: true }, false, false],
        ['WATCHING', { showSelectionScoresDuring: true }, true, true],
        ['RATING', { showSelectionScoresDuring: true }, true, true],
        ['RATING', { showSelectionScoresAfter: true }, true, false],
        ['COMPLETED', { showSelectionScoresAfter: true }, false, true],
        ['COMPLETED', { showSelectionScoresDuring: true }, true, false],
        [
            'CANCELLED',
            { showSelectionScoresDuring: true, showSelectionScoresAfter: true },
            true,
            false,
        ],
    ])(
        'should show Selection scores in %s with %o after submitting %s: %s',
        (phase, flags, hasSubmitted, canSee) => {
            expect(canViewSelectionScores({ phase }, withFlags(flags), hasSubmitted)).toBe(canSee);
        },
    );

    it.each<[TSessionPhase, Partial<IClubVisibility>, boolean, boolean]>([
        ['WATCHING', { showRatingsDuring: true }, true, false],
        ['RATING', { showRatingsDuring: true }, true, true],
        ['RATING', { showRatingsDuring: true }, false, false],
        ['RATING', { showRatingsAfter: true }, true, false],
        ['COMPLETED', { showRatingsAfter: true }, false, true],
        ['COMPLETED', { showRatingsDuring: true }, true, false],
    ])(
        'should show ratings in %s with %o after submitting %s: %s',
        (phase, flags, hasSubmitted, canSee) => {
            expect(canViewRatingResults({ phase }, withFlags(flags), hasSubmitted)).toBe(canSee);
        },
    );
});
