import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    BLOCKING_SESSION_PHASES,
    isOpenSessionPhase,
    type TCancelSession,
    type TCreateSession,
    type TSession,
    type TSessionProgress,
    type TUpdateSession,
} from '@pickflick/contracts';
import { Prisma, snapshotSessionSettings } from '@pickflick/database';

import { findMembership, lockClub } from '../clubs/access/club-access.js';
import { Transactions } from '../notifications/transactions.js';
import { NominationsService } from './nominations/nominations.service.js';
import { RatingService } from './rating/rating.service.js';
import { SelectionService } from './selection/selection.service.js';
import { assertManager, assertOpen, canManage, recordSessionAction } from './session-access.js';
import { lockSessionForMember } from './session-lock.js';
import { publishProgress } from './session-progress.js';

@Injectable()
export class SessionsService {
    constructor(
        private readonly transactions: Transactions,
        private readonly nominations: NominationsService,
        private readonly selection: SelectionService,
        private readonly rating: RatingService,
    ) {}

    async get(userId: string, id: string): Promise<TSession> {
        return this.transactions.read(
            async (transaction) => {
                const session = await transaction.session.findUnique({ where: { id } });
                if (!session) throw new NotFoundException();
                const membership = await findMembership(transaction, userId, session.clubId);
                const canManageSession = await canManage(transaction, membership);
                return {
                    ...toSession(session, membership.club.name, canManageSession),
                    rating:
                        session.phase === 'RATING' || session.phase === 'COMPLETED'
                            ? await this.rating.loadRating(transaction, session, {
                                  membership,
                                  canManage: canManageSession,
                              })
                            : null,
                    selectionOutcome: await this.selection.loadOutcome(
                        transaction,
                        session,
                        membership,
                    ),
                    selection:
                        session.phase === 'SELECTION'
                            ? await this.selection.loadSelection(transaction, session, membership)
                            : null,
                    nominations:
                        session.phase === 'NOMINATION'
                            ? await this.nominations.loadNominations(transaction, session, {
                                  userId,
                                  membership,
                                  canManage: canManageSession,
                              })
                            : null,
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async getProgress(userId: string, id: string): Promise<TSessionProgress> {
        return this.transactions.read(async (transaction) => {
            const session = await transaction.session.findUnique({
                where: { id },
                select: { clubId: true, progressVersion: true },
            });
            if (!session) throw new NotFoundException();
            await findMembership(transaction, userId, session.clubId);
            return { version: session.progressVersion };
        });
    }

    async create(userId: string, clubId: string, input: TCreateSession): Promise<TSession> {
        const id = randomUUID();
        try {
            await this.transactions.write(async (transaction) => {
                await lockClub(transaction, clubId);
                const membership = await findMembership(transaction, userId, clubId);
                await assertManager(transaction, membership);
                validateDeadline(input.deadlineAt);
                const blocking = await transaction.session.findFirst({
                    where: { clubId, phase: { in: [...BLOCKING_SESSION_PHASES] } },
                    select: { id: true },
                });
                if (blocking) throw new ConflictException({ reason: 'BLOCKING_SESSION' });
                if (
                    input.movieId &&
                    !(await transaction.movie.findUnique({ where: { id: input.movieId } }))
                ) {
                    throw new ConflictException({ reason: 'MOVIE_UNAVAILABLE' });
                }
                await transaction.session.create({
                    data: {
                        ...input,
                        id,
                        topic: input.topic ?? null,
                        notes: input.notes ?? null,
                        clubId,
                        phase: input.type === 'FULL_CYCLE' ? 'NOMINATION' : 'WATCHING',
                        ...(await snapshotSessionSettings(transaction, clubId)),
                    },
                });
                await recordSessionAction(transaction, id, membership, 'SESSION_CREATED');
            });
        } catch (error) {
            // The partial unique index is the last guard for one blocking Session per Club.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ reason: 'BLOCKING_SESSION' });
            }
            throw error;
        }
        return this.get(userId, id);
    }

    async update(userId: string, id: string, input: TUpdateSession): Promise<TSession> {
        await this.transactions.write(async (transaction) => {
            const { session, membership } = await loadWritableSession(transaction, userId, id);
            assertOpen(session.phase);
            const data: TSessionDetails = {
                scheduledAt: new Date(input.scheduledAt),
                location: input.location,
                topic: input.topic ?? null,
                notes: input.notes ?? null,
                deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
            };
            if (matchesDetails(session, data)) return;
            if (session.detailsVersion !== input.version)
                throw new ConflictException({ reason: 'SESSION_CHANGED' });
            const hasDeadlineChanged = !isSameTime(session.deadlineAt, data.deadlineAt);
            if (hasDeadlineChanged) {
                if (session.phase !== 'NOMINATION' && input.deadlineAt !== null)
                    throw new ConflictException({ reason: 'DEADLINE_PHASE' });
                validateDeadline(input.deadlineAt);
            }
            await transaction.session.update({
                where: { id },
                data: {
                    ...data,
                    detailsVersion: { increment: 1 },
                    deadlineVersion: hasDeadlineChanged ? { increment: 1 } : undefined,
                },
            });
            await recordSessionAction(transaction, id, membership, 'SESSION_UPDATED');
            await publishProgress(transaction, id, 'DETAILS');
        });
        return this.get(userId, id);
    }

    async cancel(userId: string, id: string, input: TCancelSession): Promise<TSession> {
        await this.transactions.write(async (transaction) => {
            const { session, membership } = await loadWritableSession(transaction, userId, id);
            if (session.phase === 'CANCELLED') return;
            if (session.phase === 'COMPLETED')
                throw new ConflictException({ reason: 'SESSION_CLOSED' });
            if (session.detailsVersion !== input.version)
                throw new ConflictException({ reason: 'SESSION_CHANGED' });
            await transaction.session.update({
                where: { id },
                data: {
                    phase: 'CANCELLED',
                    deadlineAt: null,
                    deadlineVersion: session.deadlineAt ? { increment: 1 } : undefined,
                    phaseVersion: { increment: 1 },
                    detailsVersion: { increment: 1 },
                },
            });
            await transaction.sessionInvite.updateMany({
                where: { participant: { sessionId: id }, revokedAt: null, respondedAt: null },
                data: { revokedAt: new Date() },
            });
            await recordSessionAction(transaction, id, membership, 'SESSION_CANCELLED');
            await publishProgress(transaction, id, 'CANCELLED');
        });
        return this.get(userId, id);
    }
}

async function loadWritableSession(
    transaction: Prisma.TransactionClient,
    userId: string,
    id: string,
) {
    const { session, membership } = await lockSessionForMember(transaction, userId, id);
    await assertManager(transaction, membership);
    return { session, membership };
}

function validateDeadline(value: string | null) {
    if (value && new Date(value) <= new Date())
        throw new ConflictException({ reason: 'DEADLINE_PAST' });
}

function toSession(
    session: Prisma.SessionGetPayload<object>,
    clubName: string,
    canManageSession: boolean,
): Omit<TSession, 'nominations' | 'selection' | 'selectionOutcome' | 'rating'> {
    const isOpen = isOpenSessionPhase(session.phase);
    return {
        id: session.id,
        clubId: session.clubId,
        clubName,
        type: session.type,
        phase: session.phase,
        scheduledAt: session.scheduledAt?.toISOString() ?? null,
        location: session.location,
        topic: session.topic,
        notes: session.notes,
        deadlineAt: session.deadlineAt?.toISOString() ?? null,
        movieId: session.movieId,
        version: session.detailsVersion,
        phaseVersion: session.phaseVersion,
        progressVersion: session.progressVersion,
        canManage: canManageSession && isOpen,
    };
}

type TSessionDetails = Pick<
    Prisma.SessionGetPayload<object>,
    'scheduledAt' | 'location' | 'topic' | 'notes' | 'deadlineAt'
>;

function matchesDetails(session: TSessionDetails, data: TSessionDetails): boolean {
    return (
        isSameTime(session.scheduledAt, data.scheduledAt) &&
        session.location === data.location &&
        session.topic === data.topic &&
        session.notes === data.notes &&
        isSameTime(session.deadlineAt, data.deadlineAt)
    );
}

function isSameTime(left: Date | null, right: Date | null): boolean {
    return left?.getTime() === right?.getTime();
}
