import {
    BLOCKING_SESSION_PHASES,
    getPosterPath,
    HUB_HISTORY_LIMIT,
    type IClubHub,
    type IClubHubSession,
} from '@pickflick/contracts';
import { Prisma } from '@pickflick/database';

import { canJoinSession, getOwnStatus } from '../sessions/session-access.js';
import { findMembership, loadClubAccess, type TMembership } from './access/club-access.js';
import { getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';
import { findActiveMembers, toClubMember } from './club-members.js';
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
    const [{ access, memberCount }, sessionCount, sessions, completed, members] = await Promise.all(
        [
            loadClubAccess(tx, membership.club),
            tx.session.count({ where: { clubId, phase: { not: 'CANCELLED' } } }),
            loadHubSessions(tx, clubId),
            readCompletedScreenings(tx, clubId, membership.role),
            findActiveMembers(tx, clubId),
        ],
    );
    const { active, recent, ratings, history } = sessions;
    const toHubSession = await createHubSessionProjection(tx, membership, [
        ...(active ? [active] : []),
        ...recent,
        ...ratings,
        ...history,
    ]);
    // Statistics need cached Movie metadata, which the caller reads outside this transaction.
    const hub: Omit<IClubHub, 'statistics'> = {
        club: toClubSummary(membership.club, membership.role),
        access,
        permissions: getClubPermissions(membership.role, membership.club.lifecycle, access),
        memberCount,
        memberLimit: getClubEntitlements(clubId).memberLimit,
        members: members.map((member) => toClubMember(membership, member)),
        sessionCount,
        completedSessionCount: completed.length,
        ...(active ? { activeSession: toHubSession(active) } : {}),
        recentSessions: recent.map(toHubSession),
        ratingSessions: ratings.map(toHubSession),
        historySessions: history.map(toHubSession),
    };
    return { hub, completed };
}

async function loadHubSessions(tx: Prisma.TransactionClient, clubId: string) {
    const newestFirst = [{ updatedAt: 'desc' as const }, { id: 'desc' as const }];
    const [active, recent, ratings, history] = await Promise.all([
        tx.session.findFirst({
            where: { clubId, phase: { in: [...BLOCKING_SESSION_PHASES] } },
            orderBy: { createdAt: 'desc' },
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: { not: 'CANCELLED' } },
            orderBy: newestFirst,
            take: RECENT_LIMIT,
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: 'RATING' },
            orderBy: newestFirst,
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: { in: ['COMPLETED', 'CANCELLED'] } },
            orderBy: newestFirst,
            take: HUB_HISTORY_LIMIT,
            include: sessionInclude,
        }),
    ]);
    return { active, recent, ratings, history };
}

/** Reads what every listed Session card needs beyond its own row, then maps rows to cards. */
async function createHubSessionProjection(
    tx: Prisma.TransactionClient,
    membership: TMembership,
    rows: THubSessionRow[],
) {
    const ids = [...new Set(rows.map(({ id }) => id))];
    const visibleRatingIds = rows
        .filter(
            (row) =>
                row.phase === 'COMPLETED' &&
                (membership.role !== 'MEMBER' || row.showRatingResults),
        )
        .map((row) => row.id);
    const [ordinalById, own, averages] = await Promise.all([
        readOrdinals(tx, membership.club.id, ids),
        tx.sessionParticipant.findMany({
            where: { membership: { userId: membership.userId }, sessionId: { in: ids } },
            select: { sessionId: true, membershipId: true, status: true },
        }),
        tx.sessionRating.groupBy({
            by: ['sessionId'],
            where: { sessionId: { in: visibleRatingIds } },
            _avg: { score: true },
        }),
    ]);
    const averageById = new Map(averages.map((row) => [row.sessionId, row._avg.score]));
    return (row: THubSessionRow): IClubHubSession => ({
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
            ownStatus: getOwnStatus(
                own.filter(({ sessionId }) => sessionId === row.id),
                membership.id,
            ),
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
}

/** A Session's number counts every Session the Club created, so cancellation never renumbers. */
async function readOrdinals(tx: Prisma.TransactionClient, clubId: string, ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await tx.$queryRaw<{ id: string; ordinal: bigint }[]>`
        SELECT id, ordinal FROM (
            SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS ordinal
            FROM "Session" WHERE "clubId" = ${clubId}::uuid
        ) numbered WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    `;
    return new Map(rows.map((row) => [row.id, Number(row.ordinal)]));
}

function getProgressCount(row: THubSessionRow) {
    if (row.phase === 'NOMINATION') return row._count.nominations;
    if (row.phase === 'SELECTION') return row._count.selectionBallots;
    if (row.phase === 'RATING') return row._count.ratings;
    return null;
}
