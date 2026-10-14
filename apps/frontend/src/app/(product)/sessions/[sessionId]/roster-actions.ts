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
    leaveSession,
    removeSessionParticipant,
    revokeSessionInvitation,
} from '@/api/session-roster.server';
import { getSession } from '@/api/sessions.server';
import { getFailureMessage } from '@/lib/action-failure';
import { ACCESS_LOST_STATUSES } from '@/lib/http-status';

// Lost access or a roster that changed meanwhile: the action no longer applies.
const STALE_ACTION_STATUSES = [...ACCESS_LOST_STATUSES, HTTP_STATUS.CONFLICT];

const commandSchema = z.discriminatedUnion('action', [
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
        if (command.action === 'invite')
            invitation = await createSessionInvitation(id, command.membershipId);
        if (command.action === 'leave') await leaveSession(id);
        if (command.action === 'remove') await removeSessionParticipant(id, command.participantId);
        if (command.action === 'revoke') await revokeSessionInvitation(id, command.inviteId);
        revalidatePath(`/sessions/${id}`);
        revalidatePath(`/clubs/${session.clubId}`);
        revalidatePath('/app');
        return {
            ok: true,
            invitation,
            message:
                command.action === 'invite'
                    ? 'Invitation created. Share this link with the selected member.'
                    : 'Roster updated.',
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
