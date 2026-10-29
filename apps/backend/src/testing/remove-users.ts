import type { PrismaClient } from '@pickflick/database';

/** Removes the users and every Club, Membership, Session, and audit row tied to them. */
export async function removeUsers(prisma: PrismaClient, userIds: string[]): Promise<void> {
    const memberships = await prisma.membership.findMany({
        where: { userId: { in: userIds } },
        select: { clubId: true },
    });
    const clubIds = [...new Set(memberships.map(({ clubId }) => clubId))];
    await prisma.clubInvite.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.clubAuditEvent.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.sessionInvite.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.sessionRating.deleteMany({ where: { session: { clubId: { in: clubIds } } } });
    await prisma.pastSelectionScore.deleteMany({
        where: { nomination: { session: { clubId: { in: clubIds } } } },
    });
    await prisma.pastNomination.deleteMany({ where: { session: { clubId: { in: clubIds } } } });
    await prisma.selectionScore.deleteMany({
        where: { ballot: { session: { clubId: { in: clubIds } } } },
    });
    await prisma.selectionBallot.deleteMany({ where: { session: { clubId: { in: clubIds } } } });
    await prisma.nomination.deleteMany({ where: { session: { clubId: { in: clubIds } } } });
    await prisma.sessionParticipant.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.nominationDeadlineDecision.deleteMany({
        where: { session: { clubId: { in: clubIds } } },
    });
    await prisma.session.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.membership.deleteMany({ where: { clubId: { in: clubIds } } });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
