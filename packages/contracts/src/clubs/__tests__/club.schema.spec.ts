import { createClubSchema, updateClubSettingsSchema } from '../club.schema.js';

const validClub = { name: '  Midnight Society ', selectionScaleMin: 0, selectionScaleMax: 7 };

describe('createClubSchema', () => {
    it('should trim the name and drop an empty description', () => {
        expect(createClubSchema.parse({ ...validClub, description: '' })).toEqual({
            name: 'Midnight Society',
            selectionScaleMin: 0,
            selectionScaleMax: 7,
        });
    });

    it('should normalise description line endings', () => {
        const club = createClubSchema.parse({ ...validClub, description: ' Noir\r\nclassics ' });

        expect(club.description).toBe('Noir\nclassics');
    });

    it.each([
        { name: 'No' },
        { name: 'Two\nlines' },
        { selectionScaleMin: 2 },
        { selectionScaleMax: 11 },
        { selectionScaleMin: 1, selectionScaleMax: 1 },
        { unexpected: true },
    ])('should reject %o', (override) => {
        expect(createClubSchema.safeParse({ ...validClub, ...override }).success).toBe(false);
    });
});

describe('updateClubSettingsSchema', () => {
    const visibility = {
        showNominationAuthorsDuring: true,
        showNominationAuthorsAfter: true,
        showSelectionScoresDuring: false,
        showSelectionScoresAfter: false,
        showRatingsDuring: false,
        showRatingsAfter: true,
        showNominationsBeforeSubmit: true,
    };

    const rules = { selectionScaleMin: 0, selectionScaleMax: 7, ...visibility };

    it('should accept either card on its own', () => {
        expect(updateClubSettingsSchema.safeParse({ name: 'Midnight Society' }).success).toBe(true);
        expect(updateClubSettingsSchema.safeParse(rules).success).toBe(true);
    });

    it.each([
        { ...rules, name: 'Midnight Society' },
        { ...rules, showRatingsAfter: undefined },
        { ...rules, selectionScaleMin: 1, selectionScaleMax: 1 },
    ])('should reject %o', (input) => {
        expect(updateClubSettingsSchema.safeParse(input).success).toBe(false);
    });
});
