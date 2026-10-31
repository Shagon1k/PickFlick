import type { PrismaClient } from '@pickflick/database';

import { describeError } from '../../../common/describe-error.js';
import { lockClub } from '../../clubs/access/club-access.js';
import { recordSessionNotifications } from '../../notifications/notification-producers.js';
import { type Transactions } from '../../notifications/transactions.js';
import { lockSession } from '../session-lock.js';
import { publishProgress } from '../session-progress.js';
import { advanceNomination } from './nomination-completion.js';

interface IDeadlineEvent {
    event: string;
    sessionId?: string;
    deadlineVersion?: number;
    outcome?: string;
    latenessMs?: number;
    reason?: string;
    due?: number;
    errorName?: string;
    errorCode?: string;
}

/**
 * Applies due Nomination deadlines. The Session row is the schedule: a Session in Nomination with
 * a passed `deadlineAt` and no decision for its current `deadlineVersion` is due. Every poll finds
 * work left by a crash or restart, so no separate job table or reconciliation is needed.
 */
export class NominationDeadlines {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly log: (event: IDeadlineEvent) => void,
        private readonly transactions: Transactions,
    ) {}

    async runOnce(now = new Date(), signal?: AbortSignal): Promise<void> {
        const candidates = await this.prisma.session.findMany({
            where: {
                phase: 'NOMINATION',
                deadlineAt: { lte: now },
                club: { lifecycle: 'ACTIVE', deletedAt: null },
            },
            select: {
                id: true,
                deadlineAt: true,
                deadlineVersion: true,
                // Versions only grow, so the newest decision tells whether this deadline is handled.
                deadlineDecisions: {
                    select: { deadlineVersion: true },
                    orderBy: { deadlineVersion: 'desc' },
                    take: 1,
                },
            },
            orderBy: [{ deadlineAt: 'asc' }, { id: 'asc' }],
        });
        // An empty deadline stays open with its decision; it is due again only after an edit.
        const due = candidates.filter(
            (session) => session.deadlineDecisions[0]?.deadlineVersion !== session.deadlineVersion,
        );
        this.log({ event: 'deadline.cycle', due: due.length });
        for (const session of due) {
            if (signal?.aborted) return;
            try {
                const outcome = await this.execute(session.id, now);
                this.log({
                    event: outcome === 'STALE' ? 'deadline.stale' : 'deadline.outcome',
                    sessionId: session.id,
                    deadlineVersion: session.deadlineVersion,
                    outcome,
                    latenessMs: Math.max(0, now.getTime() - (session.deadlineAt?.getTime() ?? 0)),
                });
            } catch (error) {
                // Database/provider messages can contain user data or connection credentials.
                this.log({
                    event: 'deadline.failure',
                    sessionId: session.id,
                    deadlineVersion: session.deadlineVersion,
                    reason: 'TRANSACTION_FAILED',
                    ...describeError(error),
                });
            }
        }
    }

    /** Decides one Session's deadline under Club → Session locks; a changed Session is `STALE`. */
    async execute(sessionId: string, now = new Date()) {
        const initial = await this.prisma.session.findUniqueOrThrow({
            where: { id: sessionId },
            select: { clubId: true },
        });
        return this.transactions.write(async (tx) => {
            await lockClub(tx, initial.clubId);
            await lockSession(tx, sessionId);
            const session = await tx.session.findUniqueOrThrow({
                where: { id: sessionId },
                include: { club: true },
            });
            const decided = await tx.nominationDeadlineDecision.findUnique({
                where: {
                    sessionId_deadlineVersion: {
                        sessionId,
                        deadlineVersion: session.deadlineVersion,
                    },
                },
            });
            if (
                session.phase !== 'NOMINATION' ||
                !session.deadlineAt ||
                session.deadlineAt > now ||
                session.club.lifecycle !== 'ACTIVE' ||
                session.club.deletedAt ||
                decided
            ) {
                return 'STALE';
            }
            const nominations = await tx.nomination.findMany({
                where: { sessionId, participant: { status: 'ACCEPTED' } },
                select: { movieId: true },
            });
            let outcome: 'EMPTY' | 'WATCHING' | 'SELECTION' = 'EMPTY';
            if (nominations.length === 1) outcome = 'WATCHING';
            if (nominations.length > 1) outcome = 'SELECTION';
            await tx.nominationDeadlineDecision.create({
                data: {
                    sessionId,
                    deadlineVersion: session.deadlineVersion,
                    outcome,
                    nominationCount: nominations.length,
                    createdAt: now,
                },
            });
            if (outcome === 'EMPTY') {
                // Nomination stays open without a deadline; an operator may set a new one.
                await tx.session.update({ where: { id: sessionId }, data: { deadlineAt: null } });
                await publishProgress(tx, sessionId, 'DETAILS');
                await recordSessionNotifications(tx, session, 'NOMINATION_STALLED');
            } else {
                await advanceNomination(tx, session, nominations, 'DEADLINE');
            }
            return outcome;
        });
    }
}
