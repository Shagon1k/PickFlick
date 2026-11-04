import { hiddenResultAchievementKeys } from '../result-visibility.js';

describe('hiddenResultAchievementKeys', () => {
    it('should hide stored result-derived awards according to current Club settings', () => {
        const club = { showRatingsAfter: false, showSelectionScoresAfter: false };
        expect(hiddenResultAchievementKeys(club)).toEqual([
            'critics-circle',
            'cult-classic',
            'shared-taste',
            'perfect-split',
        ]);
        club.showRatingsAfter = true;
        expect(hiddenResultAchievementKeys(club)).toEqual(['perfect-split']);
        club.showSelectionScoresAfter = true;
        expect(hiddenResultAchievementKeys(club)).toEqual([]);
    });
});
