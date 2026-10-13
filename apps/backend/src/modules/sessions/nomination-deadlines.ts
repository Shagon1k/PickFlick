import { lockSession, type PrismaClient } from '@pickflick/database';

import { lockClub } from '../clubs/club-access.js';
import { advanceNomination, publishProgress } from './session-progress.js';

interface IDeadlineEvent {
    event: string;
    sessionId?: string;
    deadlineVersion?: number;
    outcome?: string;
    latenessMs?: number;
    reason?: string;
}

export class NominationDeadlines {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly log: (event: IDeadlineEvent) => void,
    ) {}

    async runOnce(now = new Date(), signal?: AbortSignal): Promise<void> {
        const sessions = await this.prisma.session.findMany({
            where: {
                phase: 'NOMINATION',
                deadlineAt: { lte: now },
                club: { lifecycle: 'ACTIVE', deletedAt: null },
            },
            orderBy: [{ deadlineAt: 'asc' }, { id: 'asc' }],
            include: { deadlineDecisions: { select: { deadlineVersion: true } } },
        });
        for (const session of sessions) {
            if (signal?.aborted) return;
            if (
                session.deadlineDecisions.some(
                    (decision) => decision.deadlineVersion === session.deadlineVersion,
                )
            )
                continue;
            try {
                const outcome = await this.execute(session.id, session.deadlineVersion, now);
                this.log({
                    event: 'deadline.outcome',
                    sessionId: session.id,
                    deadlineVersion: session.deadlineVersion,
                    outcome,
                    latenessMs: Math.max(0, now.getTime() - session.deadlineAt!.getTime()),
                });
            } catch {
                // Database messages can contain user data or connection credentials.
                this.log({
                    event: 'deadline.failure',
                    sessionId: session.id,
                    reason: 'TRANSACTION_FAILED',
                });
            }
        }
        this.log({ event: 'deadline.scan' });
    }

    async execute(sessionId: string, deadlineVersion: number, now = new Date()) {
        const initial = await this.prisma.session.findUniqueOrThrow({
            where: { id: sessionId },
            select: { clubId: true },
        });
        return this.prisma.$transaction(async (tx) => {
            await lockClub(tx, initial.clubId);
            await lockSession(tx, sessionId);
            const session = await tx.session.findUniqueOrThrow({
                where: { id: sessionId },
                include: { club: true },
            });
            const decision = await tx.nominationDeadlineDecision.findUnique({
                where: { sessionId_deadlineVersion: { sessionId, deadlineVersion } },
            });
            if (decision) return 'HANDLED';
            if (
                session.phase !== 'NOMINATION' ||
                session.deadlineVersion !== deadlineVersion ||
                !session.deadlineAt ||
                session.club.deletedAt
            )
                return 'STALE';
            if (session.club.lifecycle !== 'ACTIVE') return 'PAUSED';
            if (session.deadlineAt > now) return 'EARLY';
            const nominations = await tx.nomination.findMany({
                where: { sessionId, participant: { status: 'ACCEPTED' } },
                select: { movieId: true },
            });
            let outcome: 'EMPTY' | 'WATCHING' | 'SELECTION' = 'EMPTY';
            if (nominations.length === 1) outcome = 'WATCHING';
            if (nominations.length > 1) outcome = 'SELECTION';
            const recipients =
                outcome === 'EMPTY'
                    ? await tx.membership
                          .findMany({
                              where: {
                                  clubId: session.clubId,
                                  status: 'ACTIVE',
                                  role: { in: ['ADMIN', 'MODERATOR'] },
                              },
                              select: { id: true },
                          })
                          .then((members) => members.map(({ id }) => ({ membershipId: id })))
                    : await tx.sessionParticipant.findMany({
                          where: { sessionId, status: 'ACCEPTED' },
                          select: { membershipId: true },
                      });
            await tx.nominationDeadlineDecision.create({
                data: {
                    sessionId,
                    deadlineVersion,
                    outcome,
                    nominationCount: nominations.length,
                    createdAt: now,
                    notifications: { create: recipients },
                },
            });
            if (outcome !== 'EMPTY') {
                await advanceNomination(tx, session, nominations);
                await publishProgress(tx, sessionId, 'DEADLINE');
            }
            return outcome;
        });
    }
}
