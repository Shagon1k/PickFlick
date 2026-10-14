import type { Prisma } from '@pickflick/database';

import { publishProgress } from '../session-progress.js';

/** The caller holds Club → Session locks through the decision and outbox write. */
export async function advanceNomination(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    nominations: { movieId: string }[],
) {
    await tx.session.update({
        where: { id: session.id },
        data: {
            phase: nominations.length === 1 ? 'WATCHING' : 'SELECTION',
            movieId: nominations.length === 1 ? nominations[0]!.movieId : null,
            deadlineAt: null,
            deadlineVersion: session.deadlineAt ? { increment: 1 } : undefined,
            phaseVersion: { increment: 1 },
            detailsVersion: { increment: 1 },
        },
    });
}

export async function completeNomination(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: { club: true },
    });
    let hasAdvanced = false;
    if (session.phase === 'NOMINATION' && session.club.lifecycle === 'ACTIVE') {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId, status: 'ACCEPTED' },
            select: { nomination: { select: { movieId: true } } },
        });
        const nominations = participants.flatMap((p) => (p.nomination ? [p.nomination] : []));
        if (nominations.length > 0 && nominations.length === participants.length) {
            await advanceNomination(tx, session, nominations);
            hasAdvanced = true;
        }
    }
    await publishProgress(tx, sessionId, hasAdvanced ? 'AUTOMATIC' : 'PROGRESS');
}
