import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    movieDetailsSchema,
    type TCloseNomination,
    type TNominations,
    type TSubmitNomination,
} from '@pickflick/contracts';

import { PrismaService } from '../../database/prisma.service.js';
import { findMembership, recordAudit } from '../clubs/club-access.js';
import { sourceSnapshotSchema } from '../movies/providers/movie-provider.js';
import { access } from './session-roster-access.js';
import { canManage } from './sessions.service.js';

@Injectable()
export class NominationsService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, id: string): Promise<TNominations> {
        return this.prisma.$transaction(
            async (tx) => {
                const session = await tx.session.findUnique({ where: { id } });
                if (!session) throw new NotFoundException();
                const member = await findMembership(tx, userId, session.clubId);
                const participants = await tx.sessionParticipant.findMany({
                    where: { sessionId: id, status: 'ACCEPTED' },
                    include: { nomination: true, membership: { include: { user: true } } },
                });
                const own = participants.find((p) => p.membershipId === member.id);
                const rows = await tx.nomination.findMany({
                    where: { sessionId: id, participant: { status: 'ACCEPTED' } },
                    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
                    include: {
                        participant: { include: { membership: { include: { user: true } } } },
                    },
                });
                const hidden =
                    session.phase === 'NOMINATION' &&
                    !session.showNominationsBeforeSubmit &&
                    !own?.nomination;
                const canSubmit =
                    session.phase === 'NOMINATION' &&
                    member.club.lifecycle === 'ACTIVE' &&
                    Boolean(own) &&
                    !own?.nomination;
                const history = canSubmit
                    ? await tx.nomination.findMany({
                          where: {
                              participant: { membership: { userId } },
                              session: {
                                  clubId: session.clubId,
                                  createdAt: { lt: session.createdAt },
                                  phase: { in: ['WATCHING', 'RATING', 'COMPLETED'] },
                                  movieId: { not: null },
                              },
                          },
                          include: { session: { select: { movieId: true } } },
                          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
                      })
                    : [];
                const suggestionIds = [
                    ...new Set(
                        history
                            .filter((row) => row.movieId !== row.session.movieId)
                            .map((row) => row.movieId),
                    ),
                ].slice(0, 12);
                const visible = hidden ? [] : rows;
                const ids = [
                    ...new Set([
                        ...visible.map((row) => row.movieId),
                        ...suggestionIds,
                        ...(own?.nomination ? [own.nomination.movieId] : []),
                    ]),
                ];
                const caches = await tx.movieDetailsCache.findMany({
                    where: { movieId: { in: ids } },
                    orderBy: { fetchedAt: 'desc' },
                });
                const sources = await tx.movieSourceCache.findMany({
                    where: { movieId: { in: ids }, locale: 'en-US' },
                    orderBy: { fetchedAt: 'desc' },
                });
                const movie = (movieId: string) => {
                    const cached = caches.find((row) => row.movieId === movieId);
                    const parsed = cached ? movieDetailsSchema.safeParse(cached.data) : null;
                    const source = sources.find((row) => row.movieId === movieId);
                    const snapshot = source ? sourceSnapshotSchema.safeParse(source.data) : null;
                    let metadata = snapshot?.success ? snapshot.data.data : null;
                    if (parsed?.success && parsed.data.id === movieId) metadata = parsed.data;
                    return {
                        id: movieId,
                        title: metadata?.title ?? metadata?.originalTitle ?? null,
                        year: metadata?.releaseYear ?? null,
                    };
                };
                return {
                    phase: session.phase,
                    version: session.phaseVersion,
                    acceptedCount: participants.length,
                    nominatedCount: rows.length,
                    canSubmit,
                    canClose:
                        session.phase === 'NOMINATION' &&
                        rows.length > 0 &&
                        (await canManage(tx, member)),
                    hidden,
                    ownMovie: own?.nomination ? movie(own.nomination.movieId) : null,
                    nominations: visible.map((row) => ({
                        movie: movie(row.movieId),
                        author: session.showNominationAuthors
                            ? row.participant.membership.user.displayName
                            : null,
                    })),
                    suggestions: suggestionIds.map(movie),
                };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }

    async submit(userId: string, id: string, input: TSubmitNomination): Promise<TNominations> {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await access(tx, userId, id);
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
        });
        return this.get(userId, id);
    }

    async close(userId: string, id: string, input: TCloseNomination): Promise<TNominations> {
        await this.prisma.$transaction(async (tx) => {
            const { session, member } = await access(tx, userId, id);
            if (member.role === 'MEMBER') throw new ForbiddenException();
            if (!(await canManage(tx, member)))
                throw new ConflictException({ reason: 'CLUB_READ_ONLY' });
            if (session.phase !== 'NOMINATION' || session.phaseVersion !== input.version)
                throw new ConflictException({ reason: 'NOMINATION_CHANGED' });
            const nominations = await tx.nomination.findMany({
                where: { sessionId: id, participant: { status: 'ACCEPTED' } },
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
            await tx.session.update({
                where: { id },
                data: {
                    phase: nominations.length === 1 ? 'WATCHING' : 'SELECTION',
                    movieId: nominations.length === 1 ? nominations[0]?.movieId : null,
                    deadlineAt: null,
                    phaseVersion: { increment: 1 },
                    detailsVersion: { increment: 1 },
                },
            });
        });
        return this.get(userId, id);
    }
}
