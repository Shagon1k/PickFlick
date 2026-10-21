import {
    BLOCKING_SESSION_PHASES,
    type IClubHub,
    type IClubHubSession,
    isOpenSessionPhase,
    type TMovieDetails,
} from '@pickflick/contracts';
import { Prisma } from '@pickflick/database';

import { findMembership, loadClubAccess } from './access/club-access.js';
import { canRemoveMember, getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';

const RECENT_LIMIT = 5;
const HISTORY_LIMIT = 20;
const MINUTES_PER_HOUR = 60;
const sessionInclude = {
    movie: { select: { id: true, title: true, releaseYear: true } },
    _count: {
        select: {
            participants: { where: { status: 'ACCEPTED' } },
            nominations: {
                where: { OR: [{ participant: { status: 'ACCEPTED' } }, { isInSelection: true }] },
            },
            selectionBallots: { where: { participant: { status: 'ACCEPTED' } } },
        },
    },
} satisfies Prisma.SessionInclude;

type THubSessionRow = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

export async function readClubHub(tx: Prisma.TransactionClient, userId: string, clubId: string) {
    const membership = await findMembership(tx, userId, clubId);
    const [
        { access, memberCount },
        sessionCount,
        blocking,
        recent,
        ratings,
        history,
        completed,
        members,
    ] = await Promise.all([
        loadClubAccess(tx, membership.club),
        tx.session.count({ where: { clubId } }),
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
            take: HISTORY_LIMIT,
            include: sessionInclude,
        }),
        tx.session.findMany({
            where: { clubId, phase: 'COMPLETED' },
            select: { movieId: true, scheduledAt: true },
        }),
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
    const active = blocking ?? ratings[0];
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
        canJoin:
            membership.club.lifecycle === 'ACTIVE' &&
            isOpenSessionPhase(row.phase) &&
            !['ACCEPTED', 'REMOVED'].includes(statusBySession.get(row.id) ?? ''),
        movie: row.movie
            ? {
                  id: row.movie.id,
                  title: row.movie.title,
                  year: row.movie.releaseYear,
                  runtime: null,
                  genres: [],
                  posterUrl: `/api/movies/${row.movie.id}/poster`,
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
    return null;
}

export function buildClubStatistics(
    completed: { movieId: string | null; scheduledAt: Date | null }[],
    metadata: Map<string, TMovieDetails>,
): IClubHub['statistics'] {
    const movies = completed.map((row) => (row.movieId ? metadata.get(row.movieId) : undefined));
    const hasHistory = completed.length > 0;
    const year = new Date().getUTCFullYear();
    return {
        sessionsWatched: hasHistory ? completed.length : null,
        sessionsThisYear: hasHistory
            ? completed.filter((row) => row.scheduledAt?.getUTCFullYear() === year).length
            : null,
        averageRating: null,
        totalWatchHours:
            hasHistory && movies.every((movie) => movie?.runtime)
                ? movies.reduce((sum, movie) => sum + movie!.runtime!, 0) / MINUTES_PER_HOUR
                : null,
        topGenre: getMostFrequent(movies.flatMap((movie) => movie?.genres ?? [])),
        topDirector: getMostFrequent(
            movies.flatMap((movie) => movie?.directors?.map((person) => person.name) ?? []),
        ),
        topActor: getMostFrequent(
            movies.flatMap((movie) => movie?.cast?.map((person) => person.name) ?? []),
        ),
    };
}

function getMostFrequent(values: string[]): string | null {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return (
        [...counts].sort(
            ([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b),
        )[0]?.[0] ?? null
    );
}
