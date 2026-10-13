import { randomUUID } from 'node:crypto';

import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    TCancelSession,
    TCreateSession,
    TSession,
    TUpdateSession,
} from '@pickflick/contracts';
import { Prisma, snapshotSessionSettings } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { findMembership, lockClub, recordAudit } from '../clubs/club-access.js';
import { invalidateDeadline, scheduleDeadline } from './nomination-deadline-intent.js';
import { NominationsService } from './nominations.service.js';
import { publishProgress } from './session-progress.js';
import { canManage } from './session-roster-access.js';

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
                const allowed = await canManage(transaction, membership);
                return {
                    ...project(session, membership.club.name, allowed),
                    nominations:
                        session.phase === 'NOMINATION'
                            ? await this.nominations.project(
                                  transaction,
                                  userId,
                                  session,
                                  membership,
                                  allowed,
                              )
                            : null,
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async create(userId: string, clubId: string, input: TCreateSession): Promise<TSession> {
        const id = randomUUID();
        try {
            await this.prisma.$transaction(async (transaction) => {
                await lockClub(transaction, clubId);
                const membership = await findMembership(transaction, userId, clubId);
                if (membership.role === 'MEMBER') throw new ForbiddenException();
                if (!(await canManage(transaction, membership)))
                    throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
                validateDeadline(input.deadlineAt);
                const blocking = await transaction.session.findFirst({
                    where: { clubId, phase: { in: ['NOMINATION', 'SELECTION', 'WATCHING'] } },
                    select: { id: true },
                });
                if (blocking) throw new ConflictException({ reason: 'BLOCKING_SESSION' });
                if (
                    input.movieId &&
                    !(await transaction.movie.findUnique({ where: { id: input.movieId } }))
                ) {
                    throw new ConflictException({ reason: 'MOVIE_UNAVAILABLE' });
                }
                const created = await transaction.session.create({
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
                await scheduleDeadline(transaction, created);
                await audit(transaction, membership.id, userId, clubId, id, 'SESSION_CREATED');
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ reason: 'SESSION_CONFLICT' });
            }
            throw error;
        }
        return this.get(userId, id);
    }

    async update(userId: string, id: string, input: TUpdateSession): Promise<TSession> {
        await this.prisma.$transaction(async (transaction) => {
            const { session, membership } = await writableSession(transaction, userId, id);
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
            const deadlineChanged = data.deadlineAt?.getTime() !== session.deadlineAt?.getTime();
            if (deadlineChanged) {
                if (session.phase !== 'NOMINATION' && input.deadlineAt !== null)
                    throw new ConflictException({ reason: 'DEADLINE_PHASE' });
                validateDeadline(input.deadlineAt);
            }
            const updated = await transaction.session.update({
                where: { id },
                data: {
                    ...data,
                    detailsVersion: { increment: 1 },
                    deadlineVersion: deadlineChanged ? { increment: 1 } : undefined,
                },
            });
            if (deadlineChanged) {
                await invalidateDeadline(transaction, id);
                await scheduleDeadline(transaction, updated);
            }
            await audit(transaction, membership.id, userId, session.clubId, id, 'SESSION_UPDATED');
            await publishProgress(transaction, id, 'DETAILS');
        });
        return this.get(userId, id);
    }

    async cancel(userId: string, id: string, input: TCancelSession): Promise<TSession> {
        await this.prisma.$transaction(async (transaction) => {
            const { session, membership } = await writableSession(transaction, userId, id);
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
            await invalidateDeadline(transaction, id);
            await transaction.sessionInvite.updateMany({
                where: { participant: { sessionId: id }, revokedAt: null, respondedAt: null },
                data: { revokedAt: new Date() },
            });
            await audit(
                transaction,
                membership.id,
                userId,
                session.clubId,
                id,
                'SESSION_CANCELLED',
            );
            await publishProgress(transaction, id, 'CANCELLED');
        });
        return this.get(userId, id);
    }
}

async function writableSession(transaction: Prisma.TransactionClient, userId: string, id: string) {
    const initial = await transaction.session.findUnique({
        where: { id },
        select: { clubId: true },
    });
    if (!initial) throw new NotFoundException();
    await lockClub(transaction, initial.clubId);
    const membership = await findMembership(transaction, userId, initial.clubId);
    if (membership.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(transaction, membership)))
        throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
    await transaction.$queryRaw`SELECT id FROM "Session" WHERE id = ${id}::uuid FOR UPDATE`;
    const session = await transaction.session.findUniqueOrThrow({ where: { id } });
    return { session, membership };
}

function validateDeadline(value: string | null) {
    if (value && new Date(value) <= new Date())
        throw new ConflictException({ reason: 'DEADLINE_PAST' });
}

function project(
    session: Prisma.SessionGetPayload<object>,
    clubName: string,
    allowed: boolean,
): Omit<TSession, 'nominations'> {
    const open = !['COMPLETED', 'CANCELLED'].includes(session.phase);
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
        canEdit: allowed && open,
        canCancel: allowed && open,
    };
}

async function audit(
    transaction: Prisma.TransactionClient,
    membershipId: string,
    userId: string,
    clubId: string,
    sessionId: string,
    action: 'SESSION_CREATED' | 'SESSION_UPDATED' | 'SESSION_CANCELLED',
) {
    await recordAudit(transaction, {
        clubId,
        sessionId,
        actorUserId: userId,
        subjectUserId: userId,
        subjectMembershipId: membershipId,
        action,
    });
}

function matchesDetails(
    session: Prisma.SessionGetPayload<object>,
    input: TUpdateSession | TCreateSession,
): boolean {
    return (
        session.scheduledAt?.getTime() === new Date(input.scheduledAt).getTime() &&
        session.location === input.location &&
        session.topic === (input.topic ?? null) &&
        session.notes === (input.notes ?? null) &&
        (session.deadlineAt?.getTime() ?? null) ===
            (input.deadlineAt ? new Date(input.deadlineAt).getTime() : null)
    );
}
