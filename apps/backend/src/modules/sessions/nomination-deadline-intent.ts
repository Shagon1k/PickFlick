import type { Prisma } from '@pickflick/database';

export async function invalidateDeadline(tx: Prisma.TransactionClient, sessionId: string) {
    await tx.nominationDeadlineJob.updateMany({
        where: { sessionId, finishedAt: null },
        data: { finishedAt: new Date() },
    });
}

export async function scheduleDeadline(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
) {
    if (session.phase !== 'NOMINATION' || !session.deadlineAt) return false;
    const result = await tx.nominationDeadlineJob.createMany({
        data: {
            sessionId: session.id,
            deadlineVersion: session.deadlineVersion,
            phaseVersion: session.phaseVersion,
            deadlineAt: session.deadlineAt,
        },
        skipDuplicates: true,
    });
    return result.count > 0;
}
