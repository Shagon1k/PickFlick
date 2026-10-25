import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { TCloseSelection, TSelection, TSubmitSelection } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { type findMembership, recordAudit } from '../../clubs/access/club-access.js';
import { MoviesService } from '../../movies/movies.service.js';
import { loadPastSelection } from '../past/past-selection-projection.js';
import { assertManager } from '../session-access.js';
import { lockSessionForMember } from '../session-lock.js';
import { advanceSelection, completeSelection } from './selection-completion.js';
import { loadSelectionOutcome } from './selection-outcome.js';

@Injectable()
export class SelectionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly movies: MoviesService,
    ) {}

    async loadOutcome(
        tx: Prisma.TransactionClient,
        session: Prisma.SessionGetPayload<object>,
        membership: Awaited<ReturnType<typeof findMembership>>,
    ) {
        return loadSelectionOutcome(tx, session, membership, this.movies);
    }

    async loadPastOutcome(
        tx: Prisma.TransactionClient,
        session: Prisma.SessionGetPayload<object>,
        membership: Awaited<ReturnType<typeof findMembership>>,
    ) {
        return loadPastSelection(tx, session, membership, this.movies);
    }

    async loadSelection(
        tx: Prisma.TransactionClient,
        session: Prisma.SessionGetPayload<object>,
        membership: Awaited<ReturnType<typeof findMembership>>,
    ): Promise<TSelection> {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId: session.id },
            include: { selectionBallot: { include: { scores: true } } },
        });
        const own = participants.find((participant) => participant.membershipId === membership.id);
        const ballot = own?.selectionBallot;
        const accepted = participants.filter((participant) => participant.status === 'ACCEPTED');
        const nominations = await tx.nomination.findMany({
            where: { sessionId: session.id, isInSelection: true },
            include: {
                participant: {
                    include: {
                        membership: { select: { user: { select: { displayName: true } } } },
                    },
                },
            },
            orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        });
        const movies = await this.movies.findSummaries(
            tx,
            nominations.map((row) => row.movieId),
        );
        return {
            scaleMin: session.selectionScaleMin === 0 ? 0 : 1,
            scaleMax: session.selectionScaleMax,
            acceptedCount: accepted.length,
            submittedCount: accepted.filter((participant) => participant.selectionBallot).length,
            canSubmit:
                membership.club.lifecycle === 'ACTIVE' &&
                own?.status === 'ACCEPTED' &&
                !ballot &&
                nominations.length > 0,
            submittedAt: ballot?.submittedAt.toISOString() ?? null,
            nominations: nominations.map((row) => ({
                id: row.id,
                movie: movies.get(row.movieId)!,
                author: session.showNominationAuthors
                    ? row.participant.membership.user.displayName
                    : null,
                ownScore:
                    ballot?.scores.find((score) => score.nominationId === row.id)?.score ?? null,
            })),
        };
    }

    async submit(userId: string, id: string, input: TSubmitSelection): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, id);
            if (session.phase !== 'SELECTION')
                throw new ConflictException({ reason: 'SELECTION_CLOSED' });
            if (membership.club.lifecycle !== 'ACTIVE')
                throw new ConflictException({ reason: 'CLUB_ARCHIVED' });
            const participant = await tx.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId: id, membershipId: membership.id } },
                include: { selectionBallot: true },
            });
            if (participant?.status !== 'ACCEPTED') throw new ForbiddenException();
            if (participant.selectionBallot)
                throw new ConflictException({ reason: 'ALREADY_SUBMITTED' });
            const nominations = await tx.nomination.findMany({
                where: { sessionId: id, isInSelection: true },
                select: { id: true },
            });
            const ids = new Set(input.scores.map((row) => row.nominationId));
            if (
                input.scores.length !== nominations.length ||
                ids.size !== nominations.length ||
                nominations.some((row) => !ids.has(row.id))
            )
                throw new ConflictException({ reason: 'INCOMPLETE_BALLOT' });
            if (
                input.scores.some(
                    (row) =>
                        row.score < session.selectionScaleMin ||
                        row.score > session.selectionScaleMax,
                )
            )
                throw new ConflictException({ reason: 'SCORE_OUT_OF_RANGE' });
            const ballot = await tx.selectionBallot.create({
                data: {
                    sessionId: id,
                    participantId: participant.id,
                },
            });
            await tx.selectionScore.createMany({
                data: input.scores.map((row) => ({ ...row, sessionId: id, ballotId: ballot.id })),
            });
            await completeSelection(tx, id);
        });
    }

    async close(userId: string, id: string, input: TCloseSelection): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, id);
            await assertManager(tx, membership);
            if (session.selectionResult !== null) return;
            if (session.phase !== 'SELECTION' || session.phaseVersion !== input.phaseVersion)
                throw new ConflictException({ reason: 'SELECTION_CHANGED' });
            await advanceSelection(tx, session, { kind: 'MANUAL', membershipId: membership.id });
            await recordAudit(tx, {
                clubId: session.clubId,
                sessionId: id,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'SESSION_SELECTION_CLOSED',
            });
        });
    }
}
