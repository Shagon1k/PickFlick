import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import type { TCreatePastSession, TPastSessionMembers } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { findMembership, lockClub, recordAudit } from '../../clubs/access/club-access.js';
import { assertManager } from '../session-access.js';

@Injectable()
export class PastSessionsService {
    constructor(private readonly prisma: PrismaService) {}

    async listMembers(userId: string, clubId: string): Promise<TPastSessionMembers> {
        return this.prisma.$transaction(async (tx) => {
            const actor = await findMembership(tx, userId, clubId);
            await assertManager(tx, actor);
            const members = await tx.membership.findMany({
                where: { clubId },
                select: { id: true, status: true, user: { select: { displayName: true } } },
                orderBy: { joinedAt: 'desc' },
                distinct: ['userId'],
            });
            return members.map(({ id, status, user }) => ({
                id,
                status,
                displayName: user.displayName,
            }));
        });
    }

    async create(userId: string, clubId: string, input: TCreatePastSession): Promise<string> {
        const id = randomUUID();
        await this.prisma.$transaction(async (tx) => {
            await lockClub(tx, clubId);
            const actor = await findMembership(tx, userId, clubId);
            await assertManager(tx, actor);
            if (
                !(await tx.movie.findUnique({ where: { id: input.movieId }, select: { id: true } }))
            )
                throw new ConflictException({ reason: 'MOVIE_UNAVAILABLE' });
            const members = await tx.membership.findMany({
                where: { clubId, id: { in: input.attendees.map((row) => row.membershipId) } },
                select: { userId: true },
            });
            if (members.length !== input.attendees.length)
                throw new ConflictException({ reason: 'ATTENDEE_UNAVAILABLE' });
            if (new Set(members.map((member) => member.userId)).size !== members.length)
                throw new ConflictException({ reason: 'ATTENDEE_DUPLICATE' });
            const { attendees, ...details } = input;
            await tx.session.create({
                data: {
                    ...details,
                    id,
                    clubId,
                    type: 'PAST',
                    phase: 'COMPLETED',
                    ...(await snapshotSessionSettings(tx, clubId)),
                },
            });
            for (const attendee of attendees) {
                const participant = await tx.sessionParticipant.create({
                    data: {
                        sessionId: id,
                        clubId,
                        membershipId: attendee.membershipId,
                        status: 'ACCEPTED',
                        attended: true,
                    },
                });
                if (attendee.score !== undefined)
                    await tx.sessionRating.create({
                        data: {
                            sessionId: id,
                            participantId: participant.id,
                            score: attendee.score,
                            submittedAt: null,
                        },
                    });
            }
            await recordAudit(tx, {
                clubId,
                sessionId: id,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: actor.id,
                action: 'SESSION_CREATED',
            });
        });
        return id;
    }
}
