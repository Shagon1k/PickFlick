import type { TNotificationEvent } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { recordNotification } from './notification-store.js';

type TAuditAction = Prisma.ClubAuditEventGetPayload<object>['action'];
type TSessionPhase = Prisma.SessionGetPayload<object>['phase'];

const AUDIT_EVENTS: Partial<Record<TAuditAction, TNotificationEvent>> = {
    MEMBERSHIP_JOINED: 'MEMBERSHIP_JOINED',
    MEMBERSHIP_ROLE_CHANGED: 'MEMBERSHIP_ROLE_CHANGED',
    ADMIN_TRANSFERRED: 'MEMBERSHIP_ROLE_CHANGED',
    MEMBERSHIP_REMOVED: 'MEMBERSHIP_REMOVED',
    MEMBERSHIP_LEFT: 'MEMBERSHIP_LEFT',
    CLUB_ARCHIVED: 'CLUB_ARCHIVED',
    CLUB_REACTIVATED: 'CLUB_REACTIVATED',
};

export async function recordAuditNotifications(
    tx: Prisma.TransactionClient,
    audit: Prisma.ClubAuditEventGetPayload<object>,
) {
    if (audit.action === 'SESSION_CREATED' && audit.sessionId) {
        const session = await tx.session.findUniqueOrThrow({ where: { id: audit.sessionId } });
        if (session.type !== 'PAST') {
            await recordClubNotifications(tx, {
                event: 'SESSION_STARTED',
                sourceId: session.id,
                clubId: audit.clubId,
                sessionId: session.id,
            });
        }
        return;
    }
    const event = AUDIT_EVENTS[audit.action];
    if (!event) return;
    const input = { event, sourceId: audit.id, clubId: audit.clubId };
    if (event === 'CLUB_ARCHIVED' || event === 'CLUB_REACTIVATED') {
        await recordClubNotifications(tx, input);
        return;
    }
    await recordNotification(tx, { ...input, recipientId: audit.subjectUserId });
    if (audit.action === 'ADMIN_TRANSFERRED' && audit.actorUserId !== audit.subjectUserId) {
        await recordNotification(tx, { ...input, recipientId: audit.actorUserId });
    }
}

async function recordClubNotifications(
    tx: Prisma.TransactionClient,
    input: { event: TNotificationEvent; sourceId: string; clubId: string; sessionId?: string },
) {
    const members = await tx.membership.findMany({
        where: { clubId: input.clubId, status: 'ACTIVE' },
        select: { userId: true },
    });
    for (const member of members) {
        await recordNotification(tx, { ...input, recipientId: member.userId });
    }
}

export async function recordSessionNotifications(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    event: TNotificationEvent,
) {
    const isModeratorAttentionRequired = event === 'NOMINATION_STALLED';
    const audienceFilter: Prisma.MembershipWhereInput = isModeratorAttentionRequired
        ? { role: { in: ['ADMIN', 'MODERATOR'] } }
        : { sessionParticipants: { some: { sessionId: session.id, status: 'ACCEPTED' } } };
    const members = await tx.membership.findMany({
        where: {
            clubId: session.clubId,
            status: 'ACTIVE',
            ...audienceFilter,
        },
        select: { userId: true },
    });
    for (const member of members) {
        await recordNotification(tx, {
            recipientId: member.userId,
            event,
            sourceId: session.id,
            occurrence: isModeratorAttentionRequired
                ? session.deadlineVersion
                : session.phaseVersion,
            clubId: session.clubId,
            sessionId: session.id,
        });
    }
}

const PHASE_EVENTS: Partial<Record<TSessionPhase, TNotificationEvent>> = {
    SELECTION: 'SELECTION_OPENED',
    WATCHING: 'SELECTION_CLOSED',
    RATING: 'RATING_OPENED',
    COMPLETED: 'RATING_CLOSED',
    CANCELLED: 'SESSION_CANCELLED',
};

/** The event a Session sends when it enters `phase`; Nomination starts with SESSION_STARTED instead. */
export function getSessionNotificationEvent(phase: TSessionPhase): TNotificationEvent | null {
    return PHASE_EVENTS[phase] ?? null;
}

export async function recordAchievementNotifications(
    tx: Prisma.TransactionClient,
    awards: Prisma.AchievementAwardGetPayload<object>[],
) {
    for (const award of awards) {
        const recipients = award.userId
            ? [{ userId: award.userId }]
            : await tx.membership.findMany({
                  where: {
                      clubId: award.clubId!,
                      status: 'ACTIVE',
                      club: { deletedAt: null },
                      role: award.private ? { in: ['ADMIN', 'MODERATOR'] } : undefined,
                  },
                  select: { userId: true },
              });
        for (const recipient of recipients) {
            await recordNotification(tx, {
                recipientId: recipient.userId,
                event: 'ACHIEVEMENT_EARNED',
                sourceId: award.id,
                awardId: award.id,
                clubId: award.clubId ?? undefined,
            });
        }
    }
}
