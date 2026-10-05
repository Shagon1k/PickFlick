import { invitationPreviewSchema, respondInvitationSchema } from '../invitation.schema.js';

describe('Invitation schemas', () => {
    it('should reject paths, extra fields, wrong invite types, and invalid decisions', () => {
        for (const input of [
            { token: '/invite/session/example', decision: 'accept' },
            { token: 'x'.repeat(43), decision: 'join' },
            { token: 'x'.repeat(43), decision: 'accept', clubId: 'extra' },
        ])
            expect(respondInvitationSchema.safeParse(input).success).toBe(false);
        expect(
            respondInvitationSchema.safeParse({ token: 'x'.repeat(43), decision: 'accept' })
                .success,
        ).toBe(true);
    });
    it('should reject an unsafe preview without its required state fields', () => {
        expect(
            invitationPreviewSchema.safeParse({ state: 'valid', clubName: 'Name' }).success,
        ).toBe(false);
        expect(invitationPreviewSchema.parse({ state: 'invalid', clubName: 'private' })).toEqual({
            state: 'invalid',
        });
    });
});
