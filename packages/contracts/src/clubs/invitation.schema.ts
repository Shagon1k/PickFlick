import { z } from 'zod';

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
export const previewInvitationSchema = z.object({ token: invitationTokenSchema }).strict();
export const respondInvitationSchema = previewInvitationSchema.extend({
    decision: z.enum(['accept', 'decline']),
});
export const createInvitationSchema = z.object({ targetUserId: z.uuid().optional() }).strict();
export type TCreateInvitation = z.infer<typeof createInvitationSchema>;
export type TRespondInvitation = z.infer<typeof respondInvitationSchema>;

export const invitationPreviewSchema = z.discriminatedUnion('state', [
    z.object({
        state: z.literal('valid'),
        clubName: z.string(),
        memberCount: z.number().int(),
        inviterName: z.string(),
        expiresAt: z.iso.datetime(),
    }),
    z.object({ state: z.enum(['already-member', 'accepted']), clubId: z.uuid() }),
    z.object({
        state: z.enum(['invalid', 'expired', 'revoked', 'over-limit', 'unavailable', 'declined']),
    }),
]);
export type TInvitationPreview = z.infer<typeof invitationPreviewSchema>;
export interface ICreatedInvitation {
    id: string;
    token: string;
    expiresAt: string;
}
export interface IManagedInvitation {
    id: string;
    expiresAt: string;
    state: 'pending' | 'expired' | 'revoked' | 'accepted' | 'declined';
}
