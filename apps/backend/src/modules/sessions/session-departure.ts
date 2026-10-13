import type { Prisma } from '@pickflick/database';

import { recordAudit } from '../clubs/club-access.js';
import { lockSession } from './session-lock.js';
import { completeNomination } from './session-progress.js';

/** The caller holds the Club lock; completed attendance/history stays intact. */
export async function departSessions(
    tx: Prisma.TransactionClient,
    membershipId: string,
    actorUserId: string,
    status: 'LEFT' | 'REMOVED',
) {
    const participants = await tx.sessionParticipant.findMany({
        where: {
            membershipId,
            status: { in: ['ACCEPTED', 'INVITED'] },
            session: { phase: { in: ['NOMINATION', 'SELECTION', 'WATCHING', 'RATING'] } },
        },
        include: { membership: true },
        orderBy: { sessionId: 'asc' },
    });
    for (const participant of participants) {
        await lockSession(tx, participant.sessionId);
        await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status } });
        await tx.sessionInvite.updateMany({
            where: { participantId: participant.id, respondedAt: null, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await recordAudit(tx, {
            clubId: participant.clubId,
            sessionId: participant.sessionId,
            actorUserId,
            subjectUserId: participant.membership.userId,
            subjectMembershipId: membershipId,
            action: status === 'LEFT' ? 'SESSION_PARTICIPANT_LEFT' : 'SESSION_PARTICIPANT_REMOVED',
        });
        await completeNomination(tx, participant.sessionId);
    }
}
