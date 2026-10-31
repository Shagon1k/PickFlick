import { isLegalDocumentName } from '../legal-content';

describe('isLegalDocumentName', () => {
    it('should accept published documents', () => {
        expect(isLegalDocumentName('privacy')).toBe(true);
        expect(isLegalDocumentName('terms')).toBe(true);
    });

    it.each(['constructor', '__proto__', 'toString', 'cookies'])(
        'should reject %s so the page answers 404',
        (name) => {
            expect(isLegalDocumentName(name)).toBe(false);
        },
    );
});
