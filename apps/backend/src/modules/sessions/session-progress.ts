import type { Prisma } from '@pickflick/database';

export async function publishProgress(
    tx: Prisma.TransactionClient,
    sessionId: string,
    kind: 'PROGRESS' | 'AUTOMATIC' | 'MANUAL' | 'DEADLINE' | 'DETAILS' | 'CANCELLED',
) {
    const session = await tx.session.update({
        where: { id: sessionId },
        data: { progressVersion: { increment: 1 } },
    });
    const participants = await tx.sessionParticipant.findMany({
        where: { sessionId, status: 'ACCEPTED' },
        select: { membershipId: true, nomination: { select: { movieId: true } } },
    });
    await tx.sessionProgressEvent.create({
        data: {
            sessionId,
            version: session.progressVersion,
            kind,
            phase: session.phase,
            phaseVersion: session.phaseVersion,
            detailsVersion: session.detailsVersion,
            acceptedCount: participants.length,
            nominatedCount: participants.filter((participant) => participant.nomination).length,
            recipientIds: participants.map((participant) => participant.membershipId),
        },
    });
}
