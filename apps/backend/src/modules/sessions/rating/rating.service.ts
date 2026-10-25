import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { TCloseRating, TRating, TSubmitRating } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { type findMembership, recordAudit } from '../../clubs/access/club-access.js';
import { assertManager, canManage } from '../session-access.js';
import { lockSessionForMember } from '../session-lock.js';
import { advanceRating, completeRating } from './rating-completion.js';

@Injectable()
export class RatingService {
    constructor(private readonly prisma: PrismaService) {}

    async loadRating(
        tx: Prisma.TransactionClient,
        session: Prisma.SessionGetPayload<object>,
        membership: Awaited<ReturnType<typeof findMembership>>,
    ): Promise<TRating> {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId: session.id },
            include: {
                rating: true,
                membership: { select: { user: { select: { displayName: true } } } },
            },
            orderBy: { id: 'asc' },
        });
        const own = participants.find((participant) => participant.membershipId === membership.id);
        const accepted = participants.filter((participant) => participant.status === 'ACCEPTED');
        const received = participants.flatMap((participant) =>
            participant.rating
                ? [
                      {
                          ...toRating(participant.rating),
                          id: participant.rating.id,
                          author: participant.membership.user.displayName,
                      },
                  ]
                : [],
        );
        const isOpen = session.phase === 'RATING';
        const canSeeResults =
            session.phase === 'COMPLETED' &&
            (membership.role !== 'MEMBER' || session.showRatingResults);
        return {
            acceptedCount: accepted.length,
            submittedCount: accepted.filter((participant) => participant.rating).length,
            receivedCount: received.length,
            canSubmit:
                isOpen &&
                membership.club.lifecycle === 'ACTIVE' &&
                own?.status === 'ACCEPTED' &&
                !own.rating,
            canClose: isOpen && (await canManage(tx, membership)),
            own: own?.rating ? toRating(own.rating) : null,
            results: canSeeResults
                ? {
                      average: received.length
                          ? received.reduce((total, rating) => total + rating.score, 0) /
                            received.length
                          : null,
                      entries: received,
                  }
                : null,
        };
    }

    async submit(userId: string, id: string, input: TSubmitRating): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, id);
            if (membership.club.lifecycle !== 'ACTIVE')
                throw new ConflictException({ reason: 'CLUB_ARCHIVED' });
            const participant = await tx.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId: id, membershipId: membership.id } },
                include: { rating: true },
            });
            if (participant?.status !== 'ACCEPTED') throw new ForbiddenException();
            if (participant.rating) {
                if (
                    participant.rating.score === input.score &&
                    participant.rating.comment === (input.comment || null)
                )
                    return;
                throw new ConflictException({ reason: 'ALREADY_SUBMITTED' });
            }
            if (session.phase !== 'RATING')
                throw new ConflictException({ reason: 'RATING_CLOSED' });
            if (!session.movieId) throw new ConflictException({ reason: 'RATING_MOVIE_MISSING' });
            await tx.sessionRating.create({
                data: {
                    sessionId: id,
                    participantId: participant.id,
                    score: input.score,
                    comment: input.comment || null,
                },
            });
            const data = { score: input.score, source: 'SESSION' as const };
            await tx.personalMovieRating.upsert({
                where: { userId_movieId: { userId, movieId: session.movieId } },
                create: { userId, movieId: session.movieId, ...data },
                update: data,
            });
            await completeRating(tx, id);
        });
    }

    async close(userId: string, id: string, input: TCloseRating): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, id);
            await assertManager(tx, membership);
            if (session.phase === 'COMPLETED') return;
            if (session.phase !== 'RATING' || session.phaseVersion !== input.phaseVersion)
                throw new ConflictException({ reason: 'RATING_CHANGED' });
            await advanceRating(tx, id, 'MANUAL');
            await recordAudit(tx, {
                clubId: session.clubId,
                sessionId: id,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'SESSION_RATING_CLOSED',
            });
        });
    }
}

function toRating(rating: { score: number; comment: string | null; submittedAt: Date | null }) {
    return {
        score: rating.score,
        comment: rating.comment,
        submittedAt: rating.submittedAt?.toISOString() ?? null,
    };
}
