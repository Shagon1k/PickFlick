import { buildSessionInput, getInitialSessionValues } from '../SessionForm/session-form';

describe('Session form', () => {
    const values = { ...getInitialSessionValues(), date: '2090-12-01', location: 'Room A' };

    it('should store the venue time with the date, and midnight without one', () => {
        expect(buildSessionInput({ ...values, time: '20:30' }, null)).toMatchObject({
            scheduledAt: '2090-12-01T20:30:00.000Z',
        });
        expect(buildSessionInput(values, null)).toMatchObject({
            scheduledAt: '2090-12-01T00:00:00.000Z',
        });
    });

    it('should read the time back only when the Session has one', () => {
        const session = (scheduledAt: string) =>
            getInitialSessionValues({ scheduledAt } as Parameters<
                typeof getInitialSessionValues
            >[0]);
        expect(session('2090-12-01T20:30:00.000Z')).toMatchObject({
            date: '2090-12-01',
            time: '20:30',
        });
        expect(session('2090-12-01T00:00:00.000Z')).toMatchObject({ time: '' });
    });
});
