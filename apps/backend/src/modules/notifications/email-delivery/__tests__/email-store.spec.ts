import { hashEmailAddress } from '../email-store.js';

describe('hashEmailAddress', () => {
    it('should match an address however its case and surrounding spaces were written', () => {
        expect(hashEmailAddress(' It-Viewer@Example.INVALID ')).toBe(
            hashEmailAddress('it-viewer@example.invalid'),
        );
    });
});
