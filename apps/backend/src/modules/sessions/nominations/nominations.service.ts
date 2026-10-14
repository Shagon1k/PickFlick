import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
    type TCloseNomination,
    type TNominations,
    type TSubmitNomination,
} from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { PrismaService } from '../../../database/prisma.service.js';
import { findMembership, recordAudit } from '../../clubs/access/club-access.js';
import { MoviesService } from '../../movies/movies.service.js';
import { assertManager } from '../session-access.js';
import { lockSessionForMember } from '../session-lock.js';
import { publishProgress } from '../session-progress.js';
import { advanceNomination, completeNomination } from './nomination-completion.js';

@Injectable()
export class NominationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly movies: MoviesService,
    ) {}

    async project(
        tx: Prisma.TransactionClient,
        session: Prisma.SessionGetPayload<object>,
        viewer: {
            userId: string;
            member: Awaited<ReturnType<typeof findMembership>>;
            canManage: boolean;
        },
    ): Promise<TNominations> {
        const { member } = viewer;
        const id = session.id;
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId: id, status: 'ACCEPTED' },
            select: {
                membershipId: true,
                nomination: { select: { id: true, movieId: true, submittedAt: true } },
                membership: { select: { user: { select: { displayName: true } } } },
            },
        });
        const own = participants.find((participant) => participant.membershipId === member.id);
        const rows = participants
            .flatMap((participant) =>
                participant.nomination
                    ? [
                          {
                              ...participant.nomination,
                              author: participant.membership.user.displayName,
                          },
                      ]
                    : [],
            )
            .sort(
                (a, b) =>
                    a.submittedAt.getTime() - b.submittedAt.getTime() || a.id.localeCompare(b.id),
            );
        const isHidden = !session.showNominationsBeforeSubmit && !own?.nomination;
        const canSubmit = member.club.lifecycle === 'ACTIVE' && Boolean(own) && !own?.nomination;
        const suggestionIds = canSubmit
            ? await pastLosingNominations(tx, viewer.userId, session)
            : [];
        const visible = isHidden ? [] : rows;
        const ids = [
            ...new Set([
                ...visible.map((row) => row.movieId),
                ...suggestionIds,
                ...(own?.nomination ? [own.nomination.movieId] : []),
            ]),
        ];
        const summaries = await this.movies.cachedSummaries(tx, ids);
        const movie = (movieId: string) => summaries.get(movieId)!;
        return {
            acceptedCount: participants.length,
            nominatedCount: rows.length,
            canSubmit,
            canClose: rows.length > 0 && viewer.canManage,
            hidden: isHidden,
            ownMovie: own?.nomination ? movie(own.nomination.movieId) : null,
            nominations: visible.map((row) => ({
                movie: movie(row.movieId),
                author: session.showNominationAuthors ? row.author : null,
            })),
            suggestions: suggestionIds.map(movie),
        };
    }

    async submit(userId: string, id: string, input: TSubmitNomination): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await lockSessionForMember(tx, userId, id);
            if (session.phase !== 'NOMINATION')
                throw new ConflictException({ reason: 'NOMINATION_CLOSED' });
            if (member.club.lifecycle !== 'ACTIVE')
                throw new ConflictException({ reason: 'CLUB_ARCHIVED' });
            const participant = await tx.sessionParticipant.findUnique({
                where: { sessionId_membershipId: { sessionId: id, membershipId: member.id } },
                include: { nomination: true },
            });
            if (participant?.status !== 'ACCEPTED') throw new ForbiddenException();
            if (participant.nomination)
                throw new ConflictException({ reason: 'ALREADY_NOMINATED' });
            if (!(await tx.movie.findUnique({ where: { id: input.movieId } })))
                throw new ConflictException({ reason: 'MOVIE_UNAVAILABLE' });
            await tx.nomination.create({
                data: { sessionId: id, participantId: participant.id, movieId: input.movieId },
            });
            await completeNomination(tx, id);
        });
    }

    async close(userId: string, id: string, input: TCloseNomination): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await lockSessionForMember(tx, userId, id);
            await assertManager(tx, member);
            if (session.phase !== 'NOMINATION' || session.phaseVersion !== input.phaseVersion)
                throw new ConflictException({ reason: 'NOMINATION_CHANGED' });
            const nominations = await tx.nomination.findMany({
                where: { sessionId: id, participant: { status: 'ACCEPTED' } },
                select: { movieId: true },
            });
            if (!nominations.length) throw new ConflictException({ reason: 'NO_NOMINATIONS' });
            await recordAudit(tx, {
                clubId: session.clubId,
                sessionId: id,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: member.id,
                action: 'SESSION_NOMINATION_CLOSED',
            });
            await advanceNomination(tx, session, nominations);
            await publishProgress(tx, id, 'MANUAL');
        });
    }
}

/** Up to 12 Movies the viewer nominated in earlier decided Sessions of this Club that did not win. */
async function pastLosingNominations(
    tx: Prisma.TransactionClient,
    userId: string,
    session: Prisma.SessionGetPayload<object>,
): Promise<string[]> {
    const history = await tx.nomination.findMany({
        where: {
            participant: { membership: { userId } },
            session: {
                clubId: session.clubId,
                createdAt: { lt: session.createdAt },
                phase: { in: ['WATCHING', 'RATING', 'COMPLETED'] },
                movieId: { not: null },
            },
        },
        select: { movieId: true, session: { select: { movieId: true } } },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    });
    return [
        ...new Set(
            history.filter((row) => row.movieId !== row.session.movieId).map((row) => row.movieId),
        ),
    ].slice(0, 12);
}
