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
        showNominationAuthors: true,
        showNominationsBeforeSubmit: true,
        showVoteResults: false,
        showRatingResults: true,
        useMonochromeMedia: true,
    };

    it('should accept Club details with every visibility flag', () => {
        expect(updateClubSettingsSchema.safeParse({ ...validClub, ...visibility }).success).toBe(
            true,
        );
    });

    it('should keep the increasing-scale rule', () => {
        const result = updateClubSettingsSchema.safeParse({
            ...validClub,
            ...visibility,
            selectionScaleMin: 1,
            selectionScaleMax: 1,
        });

        expect(result.success).toBe(false);
    });
});
