import {
    cancelSessionSchema,
    createSessionSchema,
    updateSessionSchema,
} from '../session.schema.js';

const full = {
    id: '30000000-0000-4000-8000-000000000040',
    type: 'FULL_CYCLE',
    scheduledAt: '2026-12-10T00:00:00.000Z',
    location: 'Room A',
    topic: '',
    notes: '',
    deadlineAt: null,
    movieId: null,
};
describe('Session schemas', () => {
    it('should validate both live modes and trim optional text', () => {
        expect(createSessionSchema.parse(full)).toMatchObject({
            location: 'Room A',
            topic: undefined,
        });
        expect(
            createSessionSchema.safeParse({ ...full, type: 'PRE_SELECTED', movieId: full.id })
                .success,
        ).toBe(true);
    });
    it('should reject missing fields, unsafe text, invalid dates and incompatible mode fields', () => {
        for (const input of [
            { ...full, location: '' },
            { ...full, scheduledAt: '2026-02-30T00:00:00Z' },
            { ...full, topic: 'two\nlines' },
            { ...full, notes: 'bad\u0000text' },
            { ...full, type: 'PRE_SELECTED' },
            { ...full, movieId: full.id },
            { ...full, type: 'PAST' },
            { ...full, type: 'PRE_SELECTED', movieId: full.id, deadlineAt: full.scheduledAt },
        ])
            expect(createSessionSchema.safeParse(input).success).toBe(false);
    });
    it('should prevent changing type, snapshots or selected Movie through edit requests', () => {
        const details = {
            scheduledAt: full.scheduledAt,
            location: full.location,
            topic: full.topic,
            notes: full.notes,
            deadlineAt: null,
        };
        expect(updateSessionSchema.safeParse({ ...details, version: 1 }).success).toBe(true);
        expect(
            updateSessionSchema.safeParse({ ...details, version: 1, type: 'PRE_SELECTED' }).success,
        ).toBe(false);
        expect(
            updateSessionSchema.safeParse({ ...details, version: 1, selectionScaleMax: 10 })
                .success,
        ).toBe(false);
        expect(cancelSessionSchema.safeParse({ version: 1, confirmation: 'CANCEL' }).success).toBe(
            true,
        );
        expect(cancelSessionSchema.safeParse({ version: 1, confirmation: '' }).success).toBe(false);
    });
});
