import { formatAverage, formatCalendarDate, formatHours, formatInstant } from '../format';

describe('number formats', () => {
    it('should always show one decimal for a rating average', () => {
        expect([8, 7.25, 7.96].map(formatAverage)).toEqual(['8.0', '7.3', '8.0']);
    });

    it('should show at most one decimal for hours', () => {
        expect([12, 12.54].map(formatHours)).toEqual(['12', '12.5']);
    });
});

describe('formatInstant relative', () => {
    const now = Date.parse('2026-10-31T12:00:00Z');
    it('should name the largest whole unit in the viewer clock and the date on the server', () => {
        expect(formatInstant('2026-10-31T11:59:30Z', 'relative', undefined, now)).toBe('just now');
        expect(formatInstant('2026-10-31T10:00:00Z', 'relative', undefined, now)).toBe('2 hr. ago');
        expect(formatInstant('2026-10-30T11:00:00Z', 'relative', undefined, now)).toBe('yesterday');
        expect(formatInstant('2026-10-31T10:00:00Z', 'date', 'UTC', now)).toBe('Oct 31, 2026');
    });
});

describe('formatCalendarDate', () => {
    it('should read the stored wall-clock value in UTC', () => {
        const value = '2026-11-06T23:30:00.000Z';

        expect(formatCalendarDate(value)).toBe('Nov 6, 2026');
        expect(formatCalendarDate(value, { weekday: 'long' })).toBe('Friday');
        expect(formatCalendarDate(value, { timeStyle: 'short' })).toBe('11:30 PM');
    });
});
