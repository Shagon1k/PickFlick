import { OPEN_SESSION_PHASES } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { recordAudit } from '../clubs/club-access.js';
import { lockSession } from './session-lock.js';
import { completeNomination } from './session-progress.js';
import { revokePending } from './session-roster-access.js';

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
            session: { phase: { in: [...OPEN_SESSION_PHASES] } },
        },
        include: { membership: true },
        orderBy: { sessionId: 'asc' },
    });
    for (const participant of participants) {
        await lockSession(tx, participant.sessionId);
        await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status } });
        await revokePending(tx, participant.id);
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
