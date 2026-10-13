import type { PrismaClient } from '@pickflick/database';

import { lockClub } from '../clubs/club-access.js';
import { scheduleDeadline } from './nomination-deadline-intent.js';

interface IDeadlineEvent {
    event: string;
    sessionId?: string;
    deadlineVersion?: number;
    outcome?: string;
    latenessMs?: number;
    repaired?: number;
    reason?: string;
}

export class NominationDeadlines {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly log: (event: IDeadlineEvent) => void,
    ) {}

    async runOnce(now = new Date(), signal?: AbortSignal): Promise<void> {
        // Compare columns in SQL so handled empty deadlines cannot starve missing intent.
        const missing = await this.prisma.$queryRaw<{ id: string; clubId: string }[]>`
            SELECT s.id, s."clubId" FROM "Session" s
            JOIN "Club" c ON c.id = s."clubId"
            WHERE s.phase = 'NOMINATION' AND s."deadlineAt" <= ${now}
              AND c.lifecycle = 'ACTIVE' AND c."deletedAt" IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM "NominationDeadlineJob" j
                WHERE j."sessionId" = s.id AND j."deadlineVersion" = s."deadlineVersion"
              )
            ORDER BY s.id`;
        let repaired = 0;
        for (const candidate of missing) {
            if (signal?.aborted) return;
            try {
                const created = await this.prisma.$transaction(async (tx) => {
                    await lockClub(tx, candidate.clubId);
                    await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${candidate.id}::uuid FOR UPDATE`;
                    const session = await tx.session.findUniqueOrThrow({
                        where: { id: candidate.id },
                        include: { club: true },
                    });
                    if (
                        session.club.lifecycle !== 'ACTIVE' ||
                        session.club.deletedAt ||
                        !session.deadlineAt ||
                        session.deadlineAt > now
                    )
                        return false;
                    return scheduleDeadline(tx, session);
                });
                if (created) {
                    repaired++;
                    this.log({ event: 'deadline.repaired', sessionId: candidate.id });
                }
            } catch {
                this.log({
                    event: 'deadline.failure',
                    sessionId: candidate.id,
                    reason: 'RECONCILIATION_FAILED',
                });
            }
        }
        this.log({ event: 'deadline.reconciliation', repaired });
        const jobs = await this.prisma.nominationDeadlineJob.findMany({
            where: {
                finishedAt: null,
                deadlineAt: { lte: now },
                session: { club: { lifecycle: 'ACTIVE', deletedAt: null } },
            },
            orderBy: [{ deadlineAt: 'asc' }, { sessionId: 'asc' }],
        });
        for (const job of jobs) {
            if (signal?.aborted) return;
            try {
                const outcome = await this.execute(job.sessionId, job.deadlineVersion, now);
                this.log({
                    event: outcome === 'STALE' ? 'deadline.stale' : 'deadline.outcome',
                    sessionId: job.sessionId,
                    deadlineVersion: job.deadlineVersion,
                    outcome,
                    latenessMs: Math.max(0, now.getTime() - job.deadlineAt.getTime()),
                });
            } catch {
                // Database/provider messages can contain user data or connection credentials.
                this.log({
                    event: 'deadline.failure',
                    sessionId: job.sessionId,
                    deadlineVersion: job.deadlineVersion,
                    reason: 'TRANSACTION_FAILED',
                });
            }
        }
    }

    async execute(sessionId: string, deadlineVersion: number, now = new Date()) {
        const initial = await this.prisma.session.findUniqueOrThrow({
            where: { id: sessionId },
            select: { clubId: true },
        });
        return this.prisma.$transaction(async (tx) => {
            // Every writer takes Club → Session; never take a job lock before these locks.
            await lockClub(tx, initial.clubId);
            await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "sessionId" FROM "NominationDeadlineJob"
                WHERE "sessionId" = ${sessionId}::uuid AND "deadlineVersion" = ${deadlineVersion} FOR UPDATE`;
            const session = await tx.session.findUniqueOrThrow({
                where: { id: sessionId },
                include: { club: true },
            });
            const key = { sessionId_deadlineVersion: { sessionId, deadlineVersion } };
            const job = await tx.nominationDeadlineJob.findUnique({ where: key });
            if (!job || job.finishedAt) return 'HANDLED';
            if (
                session.phase !== 'NOMINATION' ||
                session.deadlineVersion !== deadlineVersion ||
                session.phaseVersion !== job.phaseVersion ||
                session.deadlineAt?.getTime() !== job.deadlineAt.getTime() ||
                session.club.deletedAt
            ) {
                await tx.nominationDeadlineJob.update({ where: key, data: { finishedAt: now } });
                return 'STALE';
            }
            if (session.club.lifecycle !== 'ACTIVE') return 'PAUSED';
            if (job.deadlineAt > now) return 'EARLY';
            const nominations = await tx.nomination.findMany({
                where: { sessionId, participant: { status: 'ACCEPTED' } },
                select: { movieId: true },
            });
            let outcome: 'EMPTY' | 'WATCHING' | 'SELECTION' = 'EMPTY';
            if (nominations.length === 1) outcome = 'WATCHING';
            if (nominations.length > 1) outcome = 'SELECTION';
            const recipients =
                outcome === 'EMPTY'
                    ? await tx.membership.findMany({
                          where: {
                              clubId: session.clubId,
                              status: 'ACTIVE',
                              role: { in: ['ADMIN', 'MODERATOR'] },
                          },
                          select: { id: true },
                      })
                    : (
                          await tx.sessionParticipant.findMany({
                              where: { sessionId, status: 'ACCEPTED' },
                              select: { membershipId: true },
                          })
                      ).map(({ membershipId }) => ({ id: membershipId }));
            await tx.nominationDeadlineDecision.create({
                data: {
                    sessionId,
                    deadlineVersion,
                    outcome,
                    nominationCount: nominations.length,
                    createdAt: now,
                    notifications: { create: recipients.map(({ id }) => ({ membershipId: id })) },
                },
            });
            if (outcome !== 'EMPTY') {
                await tx.session.update({
                    where: { id: sessionId },
                    data: {
                        phase: outcome,
                        movieId: outcome === 'WATCHING' ? nominations[0]!.movieId : null,
                        deadlineAt: null,
                        deadlineVersion: { increment: 1 },
                        phaseVersion: { increment: 1 },
                        detailsVersion: { increment: 1 },
                    },
                });
            }
            await tx.nominationDeadlineJob.update({ where: key, data: { finishedAt: now } });
            return outcome;
        });
    }
}
