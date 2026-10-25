import { ConflictException, Injectable } from '@nestjs/common';
import type { TCreatePastSession, TPastSessionMembers } from '@pickflick/contracts';
import { snapshotSessionSettings } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { findMembership, lockClub, recordAudit } from '../../clubs/access/club-access.js';
import { assertManager } from '../session-access.js';
import {
    assertPastSelectionRange,
    assertPastSelectionReplay,
    createPastSelection,
} from './past-selection-evidence.js';

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
        const { submissionId: id, attendees, nominations, scoreMatrix, ...details } = input;
        await this.prisma.$transaction(async (tx) => {
            await lockClub(tx, clubId);
            const actor = await findMembership(tx, userId, clubId);
            await assertManager(tx, actor);
            const existing = await tx.session.findUnique({
                where: { id },
                select: {
                    clubId: true,
                    type: true,
                    scheduledAt: true,
                    location: true,
                    movieId: true,
                    topic: true,
                    notes: true,
                    participants: {
                        select: { membershipId: true, rating: { select: { score: true } } },
                    },
                    auditEvents: {
                        where: { actorUserId: userId, action: 'SESSION_CREATED' },
                        select: { id: true },
                    },
                },
            });
            if (existing) {
                if (
                    existing.clubId !== clubId ||
                    existing.type !== 'PAST' ||
                    existing.auditEvents.length === 0
                )
                    throw new ConflictException({ reason: 'SUBMISSION_CONFLICT' });
                const savedScores = new Map(
                    existing.participants.map((row) => [row.membershipId, row.rating?.score]),
                );
                const hasMatchingAttendees =
                    savedScores.size === attendees.length &&
                    attendees.every(
                        (row) =>
                            savedScores.has(row.membershipId) &&
                            savedScores.get(row.membershipId) === row.score,
                    );
                if (
                    existing.scheduledAt?.getTime() !== new Date(input.scheduledAt).getTime() ||
                    existing.location !== input.location ||
                    existing.movieId !== input.movieId ||
                    existing.topic !== (input.topic ?? null) ||
                    existing.notes !== (input.notes ?? null) ||
                    !hasMatchingAttendees
                )
                    throw new ConflictException({ reason: 'SUBMISSION_MISMATCH' });
                await assertPastSelectionReplay(tx, id, input);
                return;
            }
            const movieIds = [...new Set([input.movieId, ...nominations])];
            if ((await tx.movie.count({ where: { id: { in: movieIds } } })) !== movieIds.length)
                throw new ConflictException({ reason: 'MOVIE_UNAVAILABLE' });
            const settings = await snapshotSessionSettings(tx, clubId);
            assertPastSelectionRange(scoreMatrix, settings);
            const members = await tx.membership.findMany({
                where: { clubId, id: { in: input.attendees.map((row) => row.membershipId) } },
                select: { userId: true },
            });
            if (members.length !== input.attendees.length)
                throw new ConflictException({ reason: 'ATTENDEE_UNAVAILABLE' });
            if (new Set(members.map((member) => member.userId)).size !== members.length)
                throw new ConflictException({ reason: 'ATTENDEE_DUPLICATE' });
            await tx.session.create({
                data: {
                    ...details,
                    id,
                    clubId,
                    type: 'PAST',
                    phase: 'COMPLETED',
                    ...settings,
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
            await createPastSelection(tx, id, input);
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
