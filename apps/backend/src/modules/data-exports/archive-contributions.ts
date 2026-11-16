import type { Prisma } from '@pickflick/database';

/** Shared context is limited to IDs; free text and peer attribution stay out. */
export async function collectContributions(tx: Prisma.TransactionClient, userId: string) {
    const participant = { membership: { userId } };
    return {
        memberships: await tx.membership.findMany({
            where: { userId },
            select: {
                id: true,
                clubId: true,
                role: true,
                status: true,
                joinedAt: true,
                leftAt: true,
                updatedAt: true,
            },
        }),
        participation: await tx.sessionParticipant.findMany({
            where: participant,
            select: {
                id: true,
                sessionId: true,
                clubId: true,
                membershipId: true,
                status: true,
                attended: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        nominations: await tx.nomination.findMany({
            where: { participant },
            select: {
                id: true,
                sessionId: true,
                movieId: true,
                submittedAt: true,
                isInSelection: true,
            },
        }),
        ballots: await tx.selectionBallot.findMany({
            where: { participant },
            select: {
                id: true,
                sessionId: true,
                submittedAt: true,
                scores: {
                    select: {
                        nominationId: true,
                        score: true,
                        nomination: { select: { movieId: true } },
                    },
                },
            },
        }),
        pastNominations: await tx.pastNomination.findMany({
            where: { nominator: { userId } },
            select: { id: true, sessionId: true, movieId: true },
        }),
        pastScores: await tx.pastSelectionScore.findMany({
            where: { participant },
            select: {
                nominationId: true,
                sessionId: true,
                score: true,
                nomination: { select: { movieId: true } },
            },
        }),
        sessionRatings: await tx.sessionRating.findMany({
            where: { participant },
            select: { id: true, sessionId: true, score: true, comment: true, submittedAt: true },
        }),
        invitations: await tx.clubInvite.findMany({
            where: {
                OR: [{ inviterId: userId }, { targetUserId: userId }, { responderId: userId }],
            },
            select: { id: true, clubId: true, createdAt: true, expiresAt: true, revokedAt: true },
        }),
        invitationResponses: await tx.clubInvite.findMany({
            where: { responderId: userId },
            select: { id: true, clubId: true, respondedAt: true, accepted: true },
        }),
        auditEvents: await tx.clubAuditEvent.findMany({
            where: { OR: [{ actorUserId: userId }, { subjectUserId: userId }] },
            select: {
                id: true,
                clubId: true,
                sessionId: true,
                action: true,
                changed: true,
                createdAt: true,
            },
        }),
        roleChanges: await tx.clubAuditEvent.findMany({
            where: { subjectUserId: userId },
            select: {
                id: true,
                clubId: true,
                action: true,
                previousRole: true,
                nextRole: true,
                createdAt: true,
            },
        }),
    };
}
