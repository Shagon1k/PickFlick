import { z } from 'zod';

import type { IPendingClubInvitation } from '../clubs/invitation.schema.js';

export const createSessionInvitationSchema = z.strictObject({ membershipId: z.uuidv4() });
export type TCreateSessionInvitation = z.infer<typeof createSessionInvitationSchema>;
export const leaveSessionSchema = z.strictObject({ confirmation: z.literal('LEAVE') });
export const removeSessionParticipantSchema = z.strictObject({ confirmation: z.literal('REMOVE') });

export const sessionInvitationPreviewSchema = z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('unavailable') }),
    z.strictObject({ state: z.literal('declined') }),
    z.strictObject({ state: z.literal('accepted'), sessionId: z.uuid(), clubId: z.uuid() }),
    z.strictObject({
        state: z.literal('valid'),
        clubName: z.string(),
        topic: z.string().nullable(),
        scheduledAt: z.iso.datetime().nullable(),
        location: z.string().nullable(),
        inviterName: z.string(),
        expiresAt: z.iso.datetime(),
    }),
]);
export type TSessionInvitationPreview = z.infer<typeof sessionInvitationPreviewSchema>;
export interface IPendingSessionInvitation {
    id: string;
    clubName: string;
    topic: string | null;
    inviterName: string;
    expiresAt: string;
}
export interface ISessionRoster {
    progressVersion: number;
    acceptedCount: number;
    canInvite: boolean;
    canManage: boolean;
    canLeave: boolean;
    participants: {
        id: string;
        membershipId: string;
        displayName: string;
        status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'LEFT' | 'REMOVED';
        invitation: {
            id: string;
            expiresAt: string;
            state: 'pending' | 'expired' | 'revoked' | 'accepted' | 'declined';
        } | null;
        canRemove: boolean;
    }[];
    eligibleMembers: { id: string; displayName: string }[];
}

export type TPendingInvitation =
    | (IPendingClubInvitation & { kind: 'club' })
    | (IPendingSessionInvitation & { kind: 'session' });
