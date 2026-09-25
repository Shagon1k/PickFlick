import { contactSubmissionSchema } from '../contact.schema.js';

describe('contactSubmissionSchema', () => {
    it('should trim fields, lowercase the email, and treat blanks as absent', () => {
        expect(
            contactSubmissionSchema.parse({
                message: ' Hello \r\n',
                name: '',
                email: ' A@B.Example ',
            }),
        ).toEqual({ message: 'Hello', email: 'a@b.example' });
    });

    it.each([
        { message: '' },
        { message: 'x'.repeat(501) },
        { message: 'Hello', email: 'not-an-email' },
        { message: 'Hello', name: 'Line\nbreak' },
        { message: 'Bell \u0007' },
    ])('should reject %o', (input) => {
        expect(contactSubmissionSchema.safeParse(input).success).toBe(false);
    });
});
