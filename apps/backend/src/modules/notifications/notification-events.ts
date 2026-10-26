import type { TNotificationEvent } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { recordNotification } from './notification-store.js';

const AUDIT_EVENTS: Partial<Record<string, TNotificationEvent>> = {
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
    const members = await tx.membership.findMany({
        where: {
            clubId: session.clubId,
            status: 'ACTIVE',
            ...(event === 'NOMINATION_STALLED'
                ? { role: { in: ['ADMIN', 'MODERATOR'] } }
                : { sessionParticipants: { some: { sessionId: session.id, status: 'ACCEPTED' } } }),
        },
        select: { userId: true },
    });
    for (const member of members) {
        await recordNotification(tx, {
            recipientId: member.userId,
            event,
            sourceId: session.id,
            occurrence:
                event === 'NOMINATION_STALLED' ? session.deadlineVersion : session.phaseVersion,
            clubId: session.clubId,
            sessionId: session.id,
        });
    }
}

export function getSessionNotificationEvent(phase: string): TNotificationEvent | null {
    switch (phase) {
        case 'SELECTION':
            return 'SELECTION_OPENED';
        case 'WATCHING':
            return 'SELECTION_CLOSED';
        case 'RATING':
            return 'RATING_OPENED';
        case 'COMPLETED':
            return 'RATING_CLOSED';
        case 'CANCELLED':
            return 'SESSION_CANCELLED';
        default:
            return null;
    }
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
