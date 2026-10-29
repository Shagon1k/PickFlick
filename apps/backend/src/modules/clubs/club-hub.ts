import {
    BLOCKING_SESSION_PHASES,
    getPosterPath,
    HUB_HISTORY_LIMIT,
    type IClubHub,
    type IClubHubSession,
} from '@pickflick/contracts';
import { Prisma } from '@pickflick/database';

import { canJoinSession } from '../sessions/session-access.js';
import { findMembership, loadClubAccess } from './access/club-access.js';
import { canRemoveMember, getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';
import { readCompletedScreenings } from './statistics/completed-screenings.js';

const RECENT_LIMIT = 5;
const sessionInclude = {
    movie: { select: { id: true, title: true, releaseYear: true } },
    _count: {
        select: {
            participants: { where: { status: 'ACCEPTED' } },
            nominations: {
                where: { OR: [{ participant: { status: 'ACCEPTED' } }, { isInSelection: true }] },
            },
            selectionBallots: { where: { participant: { status: 'ACCEPTED' } } },
            ratings: { where: { participant: { status: 'ACCEPTED' } } },
        },
    },
} satisfies Prisma.SessionInclude;

type THubSessionRow = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

export async function readClubHub(tx: Prisma.TransactionClient, userId: string, clubId: string) {
    const membership = await findMembership(tx, userId, clubId);
    const [
        { access, memberCount },
        sessionCount,
        active,
        recent,
        ratings,
        history,
        completed,
        members,
    ] = await Promise.all([
        loadClubAccess(tx, membership.club),
        tx.session.count({ where: { clubId, phase: { not: 'CANCELLED' } } }),
        tx.session.findFirst({
            where: { clubId, phase: { in: [...BLOCKING_SESSION_PHASES] } },
            orderBy: { createdAt: 'desc' },
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: { not: 'CANCELLED' } },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: RECENT_LIMIT,
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: 'RATING' },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: { in: ['COMPLETED', 'CANCELLED'] } },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: HUB_HISTORY_LIMIT,
            include: sessionInclude,
        }),
        readCompletedScreenings(tx, clubId, membership.role),
        tx.membership.findMany({
            where: { clubId, status: 'ACTIVE' },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            include: {
                user: { select: { displayName: true } },
                _count: {
                    select: {
                        sessionParticipants: {
                            where: { status: 'ACCEPTED', session: { phase: { not: 'CANCELLED' } } },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = [...(active ? [active] : []), ...recent, ...ratings, ...history];
    const ids = [...new Set(rows.map(({ id }) => id))];
    // Cancellation never changes a Session's number. Existing history is never renumbered.
    const ordinals = ids.length
        ? await tx.$queryRaw<{ id: string; ordinal: bigint }[]>`
        SELECT id, ordinal FROM (
            SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS ordinal
            FROM "Session" WHERE "clubId" = ${clubId}::uuid
        ) numbered WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `
        : [];
    const ordinalById = new Map(ordinals.map((row) => [row.id, Number(row.ordinal)]));
    const own = await tx.sessionParticipant.findMany({
        where: { membershipId: membership.id, sessionId: { in: ids } },
        select: { sessionId: true, status: true },
    });
    const statusBySession = new Map(own.map((row) => [row.sessionId, row.status]));
    const visibleRatingIds = history
        .filter(
            (row) =>
                row.phase === 'COMPLETED' &&
                (membership.role !== 'MEMBER' || row.showRatingResults),
        )
        .map((row) => row.id);
    const averages = await tx.sessionRating.groupBy({
        by: ['sessionId'],
        where: { sessionId: { in: visibleRatingIds } },
        _avg: { score: true },
    });
    const averageById = new Map(averages.map((row) => [row.sessionId, row._avg.score]));
    const project = (row: THubSessionRow): IClubHubSession => ({
        id: row.id,
        ordinal: ordinalById.get(row.id)!,
        phase: row.phase,
        ...(row.topic ? { topic: row.topic } : {}),
        ...(row.location ? { location: row.location } : {}),
        ...(row.scheduledAt ? { scheduledAt: row.scheduledAt.toISOString() } : {}),
        updatedAt: row.updatedAt.toISOString(),
        acceptedCount: row._count.participants,
        nominatedCount: row._count.nominations,
        progressCount: getProgressCount(row),
        ratingAverage: averageById.get(row.id) ?? null,
        canJoin: canJoinSession({
            phase: row.phase,
            clubLifecycle: membership.club.lifecycle,
            ownStatus: statusBySession.get(row.id),
        }),
        movie: row.movie
            ? {
                  id: row.movie.id,
                  title: row.movie.title,
                  year: row.movie.releaseYear,
                  runtime: null,
                  genres: [],
                  posterUrl: getPosterPath(row.movie.id),
              }
            : null,
    });
    // Statistics need cached Movie metadata, which the caller reads outside this transaction.
    const hub: Omit<IClubHub, 'statistics'> = {
        club: toClubSummary(membership.club, membership.role),
        access,
        permissions: getClubPermissions(membership.role, membership.club.lifecycle, access),
        memberCount,
        memberLimit: getClubEntitlements(clubId).memberLimit,
        members: members.map((member) => ({
            id: member.id,
            displayName: member.user.displayName,
            role: member.role,
            joinedAt: member.joinedAt.toISOString(),
            sessionCount: member._count.sessionParticipants,
            canRemove: canRemoveMember(membership, member, membership.club.lifecycle),
        })),
        sessionCount,
        completedSessionCount: completed.length,
        ...(active ? { activeSession: project(active) } : {}),
        recentSessions: recent.map(project),
        ratingSessions: ratings.map(project),
        historySessions: history.map(project),
    };
    return { hub, completed };
}

function getProgressCount(row: THubSessionRow) {
    if (row.phase === 'NOMINATION') return row._count.nominations;
    if (row.phase === 'SELECTION') return row._count.selectionBallots;
    if (row.phase === 'RATING') return row._count.ratings;
    return null;
}
