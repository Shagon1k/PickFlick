import type { Prisma } from '@pickflick/database';

import { publishProgress } from '../session-progress.js';

/** Both completion paths hold Club → Session locks and preserve the received rows. */
export async function advanceRating(
    tx: Prisma.TransactionClient,
    sessionId: string,
    kind: 'AUTOMATIC' | 'MANUAL',
) {
    await tx.session.update({
        where: { id: sessionId },
        data: {
            phase: 'COMPLETED',
            phaseVersion: { increment: 1 },
            detailsVersion: { increment: 1 },
        },
    });
    await publishProgress(tx, sessionId, kind);
}

export async function completeRating(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: { club: true },
    });
    if (session.phase === 'RATING' && session.club.lifecycle === 'ACTIVE') {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId, status: 'ACCEPTED' },
            select: { rating: { select: { id: true } } },
        });
        if (participants.length > 0 && participants.every((participant) => participant.rating)) {
            await advanceRating(tx, sessionId, 'AUTOMATIC');
            return;
        }
    }
    await publishProgress(tx, sessionId, 'PROGRESS');
}
