import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    BLOCKING_SESSION_PHASES,
    type TCancelSession,
    type TCreateSession,
    type TSession,
    type TUpdateSession,
} from '@pickflick/contracts';
import { Prisma, snapshotSessionSettings } from '@pickflick/database';

import { PrismaService } from '../../database/prisma.service.js';
import { findMembership, lockClub, recordAudit } from '../clubs/club-access.js';
import { invalidateDeadline, scheduleDeadline } from './nomination-deadline-intent.js';
import { NominationsService } from './nominations.service.js';
import { lockSessionForMember } from './session-lock.js';
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
        try {
            await this.prisma.$transaction(async (transaction) => {
                await lockClub(transaction, clubId);
                const membership = await findMembership(transaction, userId, clubId);
                if (membership.role === 'MEMBER') throw new ForbiddenException();
                const existing = await transaction.session.findUnique({ where: { id: input.id } });
                if (existing) {
                    const creation = await transaction.clubAuditEvent.findFirst({
                        where: {
                            sessionId: input.id,
                            actorUserId: userId,
                            action: 'SESSION_CREATED',
                        },
                    });
                    if (
                        existing.clubId !== clubId ||
                        !creation ||
                        existing.type !== input.type ||
                        existing.movieId !== input.movieId ||
                        !matchesDetails(existing, input)
                    )
                        throw new ConflictException({ reason: 'SESSION_ID_CONFLICT' });
                    return;
                }
                if (!(await canManage(transaction, membership)))
                    throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
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
                const created = await transaction.session.create({
                    data: {
                        ...input,
                        topic: input.topic ?? null,
                        notes: input.notes ?? null,
                        clubId,
                        phase: input.type === 'FULL_CYCLE' ? 'NOMINATION' : 'WATCHING',
                        ...(await snapshotSessionSettings(transaction, clubId)),
                    },
                });
                await scheduleDeadline(transaction, created);
                await audit(transaction, {
                    clubId: clubId,
                    sessionId: input.id,
                    membershipId: membership.id,
                    userId,
                    action: 'SESSION_CREATED',
                });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ reason: 'SESSION_CONFLICT' });
            }
            throw error;
        }
        return this.get(userId, input.id);
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
            await audit(transaction, {
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
            await audit(transaction, {
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

async function writableSession(transaction: Prisma.TransactionClient, userId: string, id: string) {
    const { session, member } = await lockSessionForMember(transaction, userId, id);
    if (member.role === 'MEMBER') throw new ForbiddenException();
    if (!(await canManage(transaction, member)))
        throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
    return { session, membership: member };
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

/** Session lifecycle events record the acting member as their own subject. */
async function audit(
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
