import { OPEN_SESSION_PHASES } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { recordAudit } from '../../clubs/access/club-access.js';
import { completeSessionPhase } from '../session-completion.js';
import { lockSession } from '../session-lock.js';
import { revokePendingInvites } from './session-invites.js';

/**
 * The caller holds the Club lock and has already ended the Membership, so phase completion no longer
 * counts the departing member. Completed attendance/history stays intact.
 */
export async function departSessions(
    tx: Prisma.TransactionClient,
    membership: { id: string; clubId: string },
    actorUserId: string,
    status: 'LEFT' | 'REMOVED',
) {
    const participants = await tx.sessionParticipant.findMany({
        where: {
            membershipId: membership.id,
            status: { in: ['ACCEPTED', 'INVITED'] },
            session: { phase: { in: [...OPEN_SESSION_PHASES] } },
        },
        include: { membership: true },
        orderBy: { sessionId: 'asc' },
    });
    for (const participant of participants) {
        await lockSession(tx, participant.sessionId);
        await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status } });
        await revokePendingInvites(tx, participant.id);
        await recordAudit(tx, {
            clubId: participant.clubId,
            sessionId: participant.sessionId,
            actorUserId,
            subjectUserId: participant.membership.userId,
            subjectMembershipId: membership.id,
            action: status === 'LEFT' ? 'SESSION_PARTICIPANT_LEFT' : 'SESSION_PARTICIPANT_REMOVED',
        });
        await completeSessionPhase(tx, participant.sessionId);
    }
    // An unjoined member can also have been the last person holding Nomination open.
    const nomination = await tx.session.findFirst({
        where: {
            clubId: membership.clubId,
            phase: 'NOMINATION',
            id: { notIn: participants.map((participant) => participant.sessionId) },
        },
        select: { id: true },
    });
    if (nomination) {
        await lockSession(tx, nomination.id);
        await completeSessionPhase(tx, nomination.id);
    }
}
