import { validateClubValues } from '../club-form.validation';

const valid = {
    name: 'Midnight Society',
    description: 'Noir and classic cinema.',
    selectionScaleMin: '0',
    selectionScaleMax: '7',
};

describe('validateClubValues', () => {
    it('should accept both supported inclusive Selection range families', () => {
        expect(validateClubValues(valid)).toEqual({});
        expect(
            validateClubValues({ ...valid, selectionScaleMin: '1', selectionScaleMax: '10' }),
        ).toEqual({});
    });

    it.each([
        [{ ...valid, name: '' }, 'name'],
        [{ ...valid, name: 'No' }, 'name'],
        [{ ...valid, name: 'Club\nName' }, 'name'],
        [{ ...valid, description: 'x'.repeat(501) }, 'description'],
        [{ ...valid, selectionScaleMin: '2' }, 'selectionScaleMin'],
        [{ ...valid, selectionScaleMin: '1', selectionScaleMax: '1' }, 'selectionScaleMax'],
        [{ ...valid, selectionScaleMax: '11' }, 'selectionScaleMax'],
    ])('should reject invalid values %#', (values, field) => {
        expect(validateClubValues(values)).toHaveProperty(field);
    });
});
