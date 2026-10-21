'use server';

import {
    createSessionInvitationSchema,
    HTTP_STATUS,
    leaveSessionSchema,
    removeSessionParticipantSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
    createSessionInvitation,
    joinSession,
    leaveSession,
    removeSessionParticipant,
    revokeSessionInvitation,
} from '#api/session-roster.server';
import { getSession } from '#api/sessions.server';
import { getFailureMessage } from '#lib/action-failure';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

// Lost access or a roster that changed meanwhile: the action no longer applies.
const STALE_ACTION_STATUSES = [...ACCESS_LOST_STATUSES, HTTP_STATUS.CONFLICT];

const commandSchema = z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('join') }),
    createSessionInvitationSchema.extend({ action: z.literal('invite') }),
    leaveSessionSchema.extend({ action: z.literal('leave') }),
    removeSessionParticipantSchema.extend({
        action: z.literal('remove'),
        participantId: z.uuidv4(),
    }),
    z.strictObject({ action: z.literal('revoke'), inviteId: z.uuidv4() }),
]);
export async function changeRosterAction(id: string, input: unknown) {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: 'Check your selection and confirmation.' };
    try {
        const session = await getSession(id);
        const command = parsed.data;
        let invitation;
        if (command.action === 'join') await joinSession(id);
        if (command.action === 'invite')
            invitation = await createSessionInvitation(id, command.membershipId);
        if (command.action === 'leave') await leaveSession(id);
        if (command.action === 'remove') await removeSessionParticipant(id, command.participantId);
        if (command.action === 'revoke') await revokeSessionInvitation(id, command.inviteId);
        revalidatePath(`/sessions/${id}`);
        revalidatePath(`/clubs/${session.clubId}`, 'layout');
        revalidatePath('/app');
        let message = 'Roster updated.';
        if (command.action === 'invite')
            message = 'Invitation created. Share this link with the selected member.';
        if (command.action === 'join') message = 'You joined this Session.';
        return {
            ok: true,
            invitation,
            message,
        };
    } catch (error) {
        const message = getFailureMessage(error, {
            statuses: [
                [
                    STALE_ACTION_STATUSES,
                    'This action is no longer available. Reload to check your access and the Session.',
                ],
            ],
            fallback: 'We could not save your change. Check your connection and retry.',
            request: 'Session roster change',
        });
        return { ok: false, message };
    }
}
