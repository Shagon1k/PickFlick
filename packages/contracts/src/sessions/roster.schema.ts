import { z } from 'zod';

import type { IPendingClubInvitation } from '../clubs/invitation.schema.js';

export const leaveSessionSchema = z.strictObject({ confirmation: z.literal('LEAVE') });
export const removeSessionParticipantSchema = z.strictObject({ confirmation: z.literal('REMOVE') });

/** The answer to joining or declining a Session. */
export type TSessionParticipationResult =
    | { state: 'accepted'; sessionId: string; clubId: string }
    | { state: 'declined' };
export interface IPendingSessionInvitation {
    id: string;
    clubName: string;
    topic: string | null;
    scheduledAt: string | null;
}
export interface ISessionRoster {
    progressVersion: number;
    acceptedCount: number;
    memberCount: number;
    canManage: boolean;
    canLeave: boolean;
    canJoin: boolean;
    /** The viewer was removed from this Session by an operator. */
    isRemoved: boolean;
    participants: {
        id: string;
        membershipId: string;
        displayName: string;
        status: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'LEFT' | 'REMOVED';
        canRemove: boolean;
    }[];
}

export type TPendingInvitation =
    | (IPendingClubInvitation & { kind: 'club' })
    | (IPendingSessionInvitation & { kind: 'session' });
