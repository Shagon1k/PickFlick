import { createInclusiveScale } from '../scale';

describe('createInclusiveScale', () => {
    it('should build inclusive 0..N and 1..N Club score ranges', () => {
        expect(createInclusiveScale(0, 4)).toEqual([0, 1, 2, 3, 4]);
        expect(createInclusiveScale(1, 10)).toHaveLength(10);
    });

    it('should reject other starts and ranges above 10', () => {
        expect(() => createInclusiveScale(2, 5)).toThrow(/0\.\.N or 1\.\.N/);
        expect(() => createInclusiveScale(1, 11)).toThrow(/no greater than 10/);
    });
});
