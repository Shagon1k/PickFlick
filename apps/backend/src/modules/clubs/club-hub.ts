import { BLOCKING_SESSION_PHASES, type IClubHub } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { findMembership, loadClubAccess } from './access/club-access.js';
import { getClubPermissions } from './access/club-permissions.js';
import { getClubEntitlements } from './access/club-tiers.js';
import { toClubSummary } from './club.mapper.js';
import { findActiveMembers, toClubMember } from './club-members.js';
import { loadClubSessionHistory } from './club-session-history.js';
import { createHubSessionProjection, sessionInclude } from './club-session-projection.js';
import { readCompletedScreenings } from './statistics/completed-screenings.js';

const RECENT_LIMIT = 5;

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
        ...history.sessions,
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
        historySessions: history.sessions.map(toHubSession),
        historyNextCursor: history.nextCursor,
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
        loadClubSessionHistory(tx, clubId),
    ]);
    return { active, recent, ratings, history };
}
