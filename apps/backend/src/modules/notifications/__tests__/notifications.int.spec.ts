import { randomUUID } from 'node:crypto';

import {
    NOTIFICATION_EVENTS,
    notificationPreferencesSchema,
    sessionSchema,
} from '@pickflick/contracts';

import {
    addMember,
    createUser,
    type ITestApi,
    removeUsers,
    startTestApi,
} from '../../../testing/integration.js';
import { recordAudit } from '../../clubs/access/club-access.js';
import { publishProgress } from '../../sessions/session-progress.js';
import { recordAchievementNotifications } from '../notification-producers.js';
import { resolveNotification } from '../notification-resolver.js';
import { recordNotification } from '../notification-store.js';

describe('Notifications', () => {
    let api: ITestApi;
    let users: string[];
    let clubId: string;
    let memberId: string;
    const preferencesPath = '/notifications/preferences';

    beforeAll(async () => {
        api = await startTestApi();
        users = await Promise.all([
            createUser(api.prisma),
            createUser(api.prisma),
            createUser(api.prisma),
        ]);
        clubId = randomUUID();
        await api.prisma.club.create({ data: { id: clubId, name: 'PRIVATE CLUB NAME' } });
        await addMember(api.prisma, clubId, users[0]!, 'ADMIN');
        memberId = await addMember(api.prisma, clubId, users[1]!);
    });
    afterAll(async () => {
        await removeUsers(api.prisma, users);
        await api.close();
    });
    const getPreferences = async (userId = users[0]!) => {
        const response = await api.request(preferencesPath, { userId });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        return notificationPreferencesSchema.parse(await response.json());
    };
    const updatePreference = (json: unknown, userId = users[0]!) =>
        api.request(preferencesPath, {
            userId,
            method: 'PUT',
            json,
        });

    it('should expose an authenticated owner-only strict preference matrix with mandatory exceptions', async () => {
        const initial = await getPreferences();
        expect(initial.items.map((item) => item.event)).toEqual(NOTIFICATION_EVENTS);
        expect((await api.request(preferencesPath)).status).toBe(401);
        expect(
            (await api.request(`${preferencesPath}?userId=${users[1]}`, { userId: users[0] }))
                .status,
        ).toBe(400);
        for (const body of [
            { event: 'UNKNOWN', inApp: true, email: true },
            { event: 'SESSION_STARTED', inApp: 'true', email: true },
            { event: 'SESSION_STARTED', inApp: true, email: true, userId: users[1] },
        ])
            expect((await updatePreference(body)).status).toBe(400);
        expect(
            (await updatePreference({ event: 'SESSION_STARTED', inApp: false, email: true }))
                .status,
        ).toBe(200);
        expect(
            (await getPreferences()).items.find((row) => row.event === 'SESSION_STARTED'),
        ).toMatchObject({ inApp: false, email: true });
        expect(
            (await getPreferences(users[1])).items.find((row) => row.event === 'SESSION_STARTED'),
        ).toMatchObject({ inApp: true, email: false });
        expect(
            (await updatePreference({ event: 'BILLING_SERVICE', inApp: false, email: false }))
                .status,
        ).toBe(409);
        expect(
            (await updatePreference({ event: 'BILLING_SERVICE', inApp: true, email: true })).status,
        ).toBe(200);
        await expect(
            api.prisma.notificationPreference.create({
                data: { userId: users[1]!, event: 'BILLING_SERVICE', inApp: true, email: false },
            }),
        ).rejects.toThrow();
    });

    it('should deduplicate concurrent events and preserve channel decisions across preference edits and retries', async () => {
        expect(
            (await updatePreference({ event: 'SESSION_STARTED', inApp: false, email: true }))
                .status,
        ).toBe(200);
        const sourceId = randomUUID();
        const input = {
            recipientId: users[0]!,
            event: 'SESSION_STARTED' as const,
            sourceId,
            clubId,
            sessionId: randomUUID(),
        };
        const results = await Promise.all(
            Array.from({ length: 5 }, () =>
                api.prisma.$transaction((tx) => recordNotification(tx, input)),
            ),
        );
        const notification = results[0]!;
        expect(new Set(results.map((row) => row!.id)).size).toBe(1);
        expect(notification).toMatchObject({ inApp: false, email: true });
        expect(
            await api.prisma.notificationDeliveryAttempt.findMany({
                where: { notificationId: notification.id },
                orderBy: { channel: 'asc' },
            }),
        ).toMatchObject([
            { channel: 'IN_APP', attempt: 1, status: 'SUPPRESSED' },
            { channel: 'EMAIL', attempt: 1, status: 'PENDING' },
        ]);
        await updatePreference({ event: 'SESSION_STARTED', inApp: true, email: false });
        expect(await api.prisma.$transaction((tx) => recordNotification(tx, input))).toEqual(
            notification,
        );
        const next = await api.prisma.$transaction((tx) =>
            recordNotification(tx, { ...input, occurrence: 2 }),
        );
        expect(next).toMatchObject({ inApp: true, email: false });
        expect(next!.id).not.toBe(notification.id);
        const other = await api.prisma.$transaction((tx) =>
            recordNotification(tx, { ...input, recipientId: users[1]! }),
        );
        expect(other!.id).not.toBe(notification.id);
        await expect(
            api.prisma.notificationDeliveryAttempt.create({
                data: {
                    notificationId: notification.id,
                    channel: 'EMAIL',
                    attempt: 1,
                    status: 'PENDING',
                },
            }),
        ).rejects.toThrow();
        await expect(
            api.prisma.$transaction(async (tx) => {
                await tx.club.update({
                    where: { id: clubId },
                    data: { description: 'rolled back' },
                });
                await recordNotification(tx, { ...input, occurrence: 3 });
                throw new Error('source rollback');
            }),
        ).rejects.toThrow('source rollback');
        expect(await api.prisma.notification.count({ where: { sourceId, occurrence: 3 } })).toBe(0);
        expect(
            (await api.prisma.club.findUniqueOrThrow({ where: { id: clubId } })).description,
        ).toBeNull();
        await expect(
            api.prisma.$transaction(async (tx) => {
                await tx.club.update({
                    where: { id: clubId },
                    data: { description: 'must roll back' },
                });
                await recordNotification(tx, {
                    ...input,
                    clubId: undefined,
                    sessionId: undefined,
                    occurrence: 4,
                });
            }),
        ).rejects.toThrow();
        expect(
            (await api.prisma.club.findUniqueOrThrow({ where: { id: clubId } })).description,
        ).toBeNull();
    });

    it('should record live Session creation and phase notifications without copied content or progress noise', async () => {
        const response = await api.request(`/clubs/${clubId}/sessions`, {
            userId: users[0],
            method: 'POST',
            json: {
                type: 'FULL_CYCLE',
                movieId: null,
                scheduledAt: '2026-12-01T19:00:00Z',
                location: 'PRIVATE LOCATION',
                notes: 'PRIVATE NOTES',
                deadlineAt: null,
            },
        });
        expect(response.status).toBe(201);
        const session = sessionSchema.parse(await response.json());
        expect(
            await api.prisma.notification.count({
                where: { sourceId: session.id, event: 'SESSION_STARTED' },
            }),
        ).toBe(2);
        await api.prisma.sessionParticipant.create({
            data: { clubId, sessionId: session.id, membershipId: memberId, status: 'ACCEPTED' },
        });
        await api.prisma.$transaction(async (tx) => {
            await tx.session.update({
                where: { id: session.id },
                data: { phase: 'RATING', phaseVersion: { increment: 1 } },
            });
            await publishProgress(tx, session.id, 'MANUAL');
            await publishProgress(tx, session.id, 'PROGRESS');
            await publishProgress(tx, session.id, 'MANUAL');
        });
        const rows = await api.prisma.notification.findMany({ where: { sourceId: session.id } });
        expect(rows.filter((row) => row.event === 'RATING_OPENED')).toHaveLength(1);
        expect(JSON.stringify(rows)).not.toMatch(/PRIVATE|LOCATION|NOTES|displayName|payload/u);
        const row = rows.find((item) => item.event === 'RATING_OPENED')!;
        expect(await resolveNotification(api.prisma, users[1]!, row.id)).toMatchObject({
            message: 'Session Rating is open.',
            href: `/sessions/${session.id}`,
        });
        expect(await resolveNotification(api.prisma, users[2]!, row.id)).toBeNull();
        await api.prisma.sessionParticipant.deleteMany({ where: { sessionId: session.id } });
        await api.prisma.clubAuditEvent.deleteMany({ where: { sessionId: session.id } });
        await api.prisma.session.delete({ where: { id: session.id } });
        expect(await resolveNotification(api.prisma, users[1]!, row.id)).toMatchObject({
            message: 'This update is no longer available.',
            href: null,
        });
        expect(await api.prisma.notification.count({ where: { id: row.id } })).toBe(1);
    });

    it('should map affected Memberships and redact targets after departure or Club deletion', async () => {
        await api.prisma.$transaction((tx) =>
            recordAudit(tx, {
                clubId,
                actorUserId: users[0]!,
                subjectUserId: users[1]!,
                subjectMembershipId: memberId,
                action: 'MEMBERSHIP_ROLE_CHANGED',
                previousRole: 'MEMBER',
                nextRole: 'MODERATOR',
            }),
        );
        const row = await api.prisma.notification.findFirstOrThrow({
            where: { recipientId: users[1], event: 'MEMBERSHIP_ROLE_CHANGED' },
        });
        expect(await resolveNotification(api.prisma, users[1]!, row.id)).toMatchObject({
            href: `/clubs/${clubId}`,
        });
        await api.prisma.membership.update({
            where: { id: memberId },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        const departed = await resolveNotification(api.prisma, users[1]!, row.id);
        expect(departed).toMatchObject({
            message: 'This update is no longer available.',
            href: null,
        });
        expect(JSON.stringify(departed)).not.toContain(clubId);
        await api.prisma.membership.update({
            where: { id: memberId },
            data: { status: 'ACTIVE', leftAt: null },
        });
        await api.prisma.club.update({
            where: { id: clubId },
            data: { deletedAt: new Date(), lifecycle: 'ARCHIVED' },
        });
        expect(await resolveNotification(api.prisma, users[1]!, row.id)).toEqual(departed);
        await api.prisma.club.update({
            where: { id: clubId },
            data: { deletedAt: null, lifecycle: 'ACTIVE' },
        });
    });

    it('should keep the Membership-ended notice readable after the member leaves the Club', async () => {
        await api.prisma.$transaction((tx) =>
            recordAudit(tx, {
                clubId,
                actorUserId: users[0]!,
                subjectUserId: users[1]!,
                subjectMembershipId: memberId,
                action: 'MEMBERSHIP_REMOVED',
            }),
        );
        await api.prisma.membership.update({
            where: { id: memberId },
            data: { status: 'REMOVED', leftAt: new Date() },
        });
        const row = await api.prisma.notification.findFirstOrThrow({
            where: { recipientId: users[1], event: 'MEMBERSHIP_REMOVED' },
        });
        const resolved = await resolveNotification(api.prisma, users[1]!, row.id);
        expect(resolved).toMatchObject({
            message: 'Your Club Membership has ended.',
            href: null,
        });
        expect(JSON.stringify(resolved)).not.toContain(clubId);
        await api.prisma.membership.update({
            where: { id: memberId },
            data: { status: 'ACTIVE', leftAt: null },
        });
    });

    it('should target private awards only to managers and recheck roles, owners and deleted awards', async () => {
        const award = await api.prisma.achievementAward.create({
            data: {
                key: 'private-test',
                version: 1,
                clubId,
                title: 'PRIVATE AWARD TITLE',
                description: 'PRIVATE EVIDENCE',
                explanation: 'PRIVATE SCORE',
                evidence: { score: 10 },
                target: 1,
                progress: 1,
                private: true,
            },
        });
        await api.prisma.$transaction((tx) => recordAchievementNotifications(tx, [award]));
        const rows = await api.prisma.notification.findMany({ where: { sourceId: award.id } });
        expect(rows).toHaveLength(1);
        const row = rows[0]!;
        expect(row.recipientId).toBe(users[0]);
        expect(JSON.stringify(row)).not.toMatch(/PRIVATE|score|evidence|title/u);
        expect(await resolveNotification(api.prisma, users[0]!, row.id)).toMatchObject({
            href: `/clubs/${clubId}/achievements`,
        });
        await api.prisma.membership.updateMany({
            where: { clubId, userId: users[0] },
            data: { role: 'MEMBER' },
        });
        expect(await resolveNotification(api.prisma, users[0]!, row.id)).toMatchObject({
            href: null,
        });
        await api.prisma.membership.updateMany({
            where: { clubId, userId: users[0] },
            data: { role: 'ADMIN' },
        });
        await api.prisma.achievementAward.delete({ where: { id: award.id } });
        expect(await resolveNotification(api.prisma, users[0]!, row.id)).toMatchObject({
            href: null,
        });
    });

    it('should create one personal achievement notification through concurrent API evaluation and reject a foreign award target', async () => {
        await api.prisma.user.update({
            where: { id: users[1] },
            data: { image: '/private-profile.png' },
        });
        const responses = await Promise.all(
            Array.from({ length: 3 }, () =>
                api.request('/library/achievements', { userId: users[1] }),
            ),
        );
        expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
        const award = await api.prisma.achievementAward.findFirstOrThrow({
            where: { userId: users[1], key: 'opening-credits' },
        });
        const rows = await api.prisma.notification.findMany({ where: { sourceId: award.id } });
        expect(rows).toHaveLength(1);
        const notification = rows[0]!;
        expect(notification.recipientId).toBe(users[1]);
        expect(await resolveNotification(api.prisma, users[1]!, notification.id)).toMatchObject({
            href: '/library?tab=achievements',
        });
        expect(JSON.stringify(notification)).not.toContain('private-profile');
        const mismatched = await api.prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId: users[0]!,
                sourceId: award.id,
                awardId: award.id,
                event: 'ACHIEVEMENT_EARNED',
            }),
        );
        expect(await resolveNotification(api.prisma, users[0]!, mismatched!.id)).toMatchObject({
            message: 'This update is no longer available.',
            href: null,
        });
    });

    it('should persist reserved inactivity and mandatory billing events without billing data and reject invalid target shapes', async () => {
        const input = { recipientId: users[0]!, sourceId: randomUUID() };
        const billing = await api.prisma.$transaction((tx) =>
            recordNotification(tx, { ...input, event: 'BILLING_SERVICE' }),
        );
        expect(billing).toMatchObject({
            inApp: true,
            email: true,
            clubId: null,
            sessionId: null,
            awardId: null,
        });
        expect(await resolveNotification(api.prisma, users[0]!, billing!.id)).toMatchObject({
            href: '/settings',
        });
        const inactivity = await api.prisma.$transaction((tx) =>
            recordNotification(tx, { ...input, event: 'CLUB_INACTIVITY_WARNING', clubId }),
        );
        expect(inactivity).toMatchObject({ inApp: true, email: false });
        await expect(
            api.prisma.$transaction((tx) =>
                recordNotification(tx, { ...input, event: 'SESSION_STARTED' }),
            ),
        ).rejects.toThrow();
        await api.prisma.user.update({ where: { id: users[2] }, data: { status: 'SUSPENDED' } });
        expect(
            await api.prisma.$transaction((tx) =>
                recordNotification(tx, {
                    ...input,
                    recipientId: users[2]!,
                    event: 'BILLING_SERVICE',
                }),
            ),
        ).toBeNull();
    });
});
