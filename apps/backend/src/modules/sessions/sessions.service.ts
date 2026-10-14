import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    BLOCKING_SESSION_PHASES,
    type TCancelSession,
    type TCreateSession,
    type TSession,
    type TSessionProgress,
    type TUpdateSession,
} from '@pickflick/contracts';
import { Prisma, snapshotSessionSettings } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { findMembership, lockClub, recordAudit } from '../clubs/access/club-access.js';
import { NominationsService } from './nominations/nominations.service.js';
import { assertManager, canManage } from './session-access.js';
import { lockSessionForMember } from './session-lock.js';
import { publishProgress } from './session-progress.js';

@Injectable()
export class SessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly nominations: NominationsService,
    ) {}

    async get(userId: string, id: string): Promise<TSession> {
        return this.prisma.$transaction(
            async (transaction) => {
                const session = await transaction.session.findUnique({ where: { id } });
                if (!session) throw new NotFoundException();
                const membership = await findMembership(transaction, userId, session.clubId);
                const isAllowed = await canManage(transaction, membership);
                return {
                    ...project(session, membership.club.name, isAllowed),
                    nominations:
                        session.phase === 'NOMINATION'
                            ? await this.nominations.loadNominations(transaction, session, {
                                  userId,
                                  member: membership,
                                  canManage: isAllowed,
                              })
                            : null,
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async getProgress(userId: string, id: string): Promise<TSessionProgress> {
        const session = await this.prisma.session.findUnique({
            where: { id },
            select: { clubId: true, progressVersion: true },
        });
        if (!session) throw new NotFoundException();
        await findMembership(this.prisma, userId, session.clubId);
        return { version: session.progressVersion };
    }

    async create(userId: string, clubId: string, input: TCreateSession): Promise<TSession> {
        const id = randomUUID();
        try {
            await this.prisma.$transaction(async (transaction) => {
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
                await recordSessionAudit(transaction, {
                    clubId,
                    sessionId: id,
                    membershipId: membership.id,
                    userId,
                    action: 'SESSION_CREATED',
                });
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
        await this.prisma.$transaction(async (transaction) => {
            const { session, membership } = await loadWritableSession(transaction, userId, id);
            if (['COMPLETED', 'CANCELLED'].includes(session.phase))
                throw new ConflictException({ reason: 'SESSION_CLOSED' });
            const data = {
                scheduledAt: new Date(input.scheduledAt),
                location: input.location,
                topic: input.topic ?? null,
                notes: input.notes ?? null,
                deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
            };
            if (matchesDetails(session, input)) return;
            if (session.detailsVersion !== input.version)
                throw new ConflictException({ reason: 'SESSION_CHANGED' });
            const hasDeadlineChanged = data.deadlineAt?.getTime() !== session.deadlineAt?.getTime();
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
            await recordSessionAudit(transaction, {
                clubId: session.clubId,
                sessionId: id,
                membershipId: membership.id,
                userId,
                action: 'SESSION_UPDATED',
            });
            await publishProgress(transaction, id, 'DETAILS');
        });
        return this.get(userId, id);
    }

    async cancel(userId: string, id: string, input: TCancelSession): Promise<TSession> {
        await this.prisma.$transaction(async (transaction) => {
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
            await recordSessionAudit(transaction, {
                clubId: session.clubId,
                sessionId: id,
                membershipId: membership.id,
                userId,
                action: 'SESSION_CANCELLED',
            });
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
    const { session, member } = await lockSessionForMember(transaction, userId, id);
    await assertManager(transaction, member);
    return { session, membership: member };
}

function validateDeadline(value: string | null) {
    if (value && new Date(value) <= new Date())
        throw new ConflictException({ reason: 'DEADLINE_PAST' });
}

function project(
    session: Prisma.SessionGetPayload<object>,
    clubName: string,
    isAllowed: boolean,
): Omit<TSession, 'nominations'> {
    const isOpen = !['COMPLETED', 'CANCELLED'].includes(session.phase);
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
        canEdit: isAllowed && isOpen,
        canCancel: isAllowed && isOpen,
    };
}

/** Session lifecycle events record the acting member as their own subject. */
async function recordSessionAudit(
    transaction: Prisma.TransactionClient,
    event: {
        clubId: string;
        sessionId: string;
        membershipId: string;
        userId: string;
        action: 'SESSION_CREATED' | 'SESSION_UPDATED' | 'SESSION_CANCELLED';
    },
) {
    await recordAudit(transaction, {
        clubId: event.clubId,
        sessionId: event.sessionId,
        actorUserId: event.userId,
        subjectUserId: event.userId,
        subjectMembershipId: event.membershipId,
        action: event.action,
    });
}

function matchesDetails(session: Prisma.SessionGetPayload<object>, input: TUpdateSession): boolean {
    return (
        session.scheduledAt?.getTime() === new Date(input.scheduledAt).getTime() &&
        session.location === input.location &&
        session.topic === (input.topic ?? null) &&
        session.notes === (input.notes ?? null) &&
        (session.deadlineAt?.getTime() ?? null) ===
            (input.deadlineAt ? new Date(input.deadlineAt).getTime() : null)
    );
}
