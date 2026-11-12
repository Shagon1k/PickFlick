import { appearanceSchema, updateProfileSchema } from '../account.schema.js';

describe('account schemas', () => {
    it('should preserve current presentation defaults', () => {
        expect(appearanceSchema.parse({})).toEqual({
            monochrome: false,
            colorReveal: true,
            quietMode: false,
            listSpacing: 'comfortable',
            hiddenColumns: [],
        });
    });
    it('should reject essential columns and foreign account fields', () => {
        expect(appearanceSchema.safeParse({ hiddenColumns: ['film', 'value'] }).success).toBe(
            false,
        );
        expect(appearanceSchema.safeParse({ userId: 'someone-else' }).success).toBe(false);
        expect(
            updateProfileSchema.safeParse({
                displayName: 'Name',
                locale: 'en',
                email: 'other@example.invalid',
            }).success,
        ).toBe(false);
    });
    it('should trim names and reject control characters and unsupported locales', () => {
        expect(updateProfileSchema.parse({ displayName: ' Alex ', locale: 'en' }).displayName).toBe(
            'Alex',
        );
        expect(
            updateProfileSchema.safeParse({ displayName: 'Name\nother', locale: 'en' }).success,
        ).toBe(false);
        expect(updateProfileSchema.safeParse({ displayName: 'Name', locale: 'ru' }).success).toBe(
            false,
        );
    });
});
