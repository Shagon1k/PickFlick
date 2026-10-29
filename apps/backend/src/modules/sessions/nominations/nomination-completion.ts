import type { Prisma } from '@pickflick/database';

import { publishProgress } from '../session-progress.js';

/** Like Selection and Rating, the move publishes its own progress; callers hold Club → Session locks. */
export async function advanceNomination(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    nominations: { movieId: string }[],
    kind: 'AUTOMATIC' | 'MANUAL' | 'DEADLINE',
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
    await publishProgress(tx, session.id, kind);
}

export async function completeNomination(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: { club: true },
    });
    if (session.phase === 'NOMINATION' && session.club.lifecycle === 'ACTIVE') {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId, status: 'ACCEPTED' },
            select: { nomination: { select: { movieId: true } } },
        });
        const nominations = participants.flatMap((participant) =>
            participant.nomination ? [participant.nomination] : [],
        );
        if (nominations.length > 0 && nominations.length === participants.length) {
            await advanceNomination(tx, session, nominations, 'AUTOMATIC');
            return;
        }
    }
    await publishProgress(tx, sessionId, 'PROGRESS');
}
