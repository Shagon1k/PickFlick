import { hiddenResultAchievementKeys } from '../result-visibility.js';

describe('hiddenResultAchievementKeys', () => {
    it('should gate Selection-derived awards without hiding rating-aggregate awards', () => {
        const club = { showRatingsAfter: false, showSelectionScoresAfter: false };
        expect(hiddenResultAchievementKeys(club)).toEqual(['perfect-split']);
        club.showRatingsAfter = true;
        expect(hiddenResultAchievementKeys(club)).toEqual(['perfect-split']);
        club.showSelectionScoresAfter = true;
        expect(hiddenResultAchievementKeys(club)).toEqual([]);
    });
});
