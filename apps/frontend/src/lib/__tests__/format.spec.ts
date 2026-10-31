import { formatAverage, formatHours } from '../format';

describe('number formats', () => {
    it('should always show one decimal for a rating average', () => {
        expect([8, 7.25, 7.96].map(formatAverage)).toEqual(['8.0', '7.3', '8.0']);
    });

    it('should show at most one decimal for hours', () => {
        expect([12, 12.54].map(formatHours)).toEqual(['12', '12.5']);
    });
});
