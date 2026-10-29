import { randomUUID } from 'node:crypto';

import { createDatabaseClient, type PrismaClient } from '@pickflick/database';

import {
    addMember,
    createUser,
    loadIntegrationEnvironment,
} from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import type { IEmailMessage } from '../../../email/email.types.js';
import { EmailDeliveryError } from '../../../email/resend-email.client.js';
import { recordNotification } from '../../notification-store.js';
import { EmailDispatcher } from '../email-dispatcher.js';
import { claimEmail, finishEmail, hashEmailAddress } from '../email-store.js';

describe('EmailDispatcher', () => {
    let prisma: PrismaClient;
    let userId: string;
    let clubId: string;
    const send = vi.fn<(message: IEmailMessage) => Promise<string>>();
    const log = vi.fn();
    const environment = {
        databaseUrl: 'unused',
        baseUrl: 'https://uat.pick-flick.app',
        from: 'PickFlick UAT <uat@pick-flick.app>',
        apiKey: 'synthetic-only',
        deliveryEnabled: true,
        alertTo: 'test@pick-flick.app',
    };
    const buildDispatcher = (isDeliveryEnabled = true) =>
        new EmailDispatcher(
            prisma,
            { send },
            {
                environment: { ...environment, deliveryEnabled: isDeliveryEnabled },
                log,
            },
        );
    const getDelivery = (notificationId: string) =>
        prisma.notificationEmailDelivery.findUniqueOrThrow({ where: { notificationId } });
    const record = async (event: 'CLUB_ARCHIVED' | 'BILLING_SERVICE' = 'CLUB_ARCHIVED') => {
        return prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId: userId,
                sourceId: randomUUID(),
                event,
                clubId: event === 'BILLING_SERVICE' ? undefined : clubId,
            }),
        );
    };
    beforeAll(async () => {
        prisma = createDatabaseClient(loadIntegrationEnvironment().databaseUrl);
        userId = await createUser(prisma);
        clubId = randomUUID();
        await prisma.club.create({ data: { id: clubId, name: 'PRIVATE CLUB' } });
        await addMember(prisma, clubId, userId, 'ADMIN');
    });
    beforeEach(async () => {
        await prisma.notification.deleteMany({ where: { recipientId: userId } });
        await prisma.notificationEmailSuppression.deleteMany({
            where: { addressHash: hashEmailAddress(`it-${userId}@example.invalid`) },
        });
        await prisma.user.update({
            where: { id: userId },
            data: { status: 'ACTIVE', email: `it-${userId}@example.invalid` },
        });
        await prisma.membership.updateMany({
            where: { clubId, userId },
            data: { status: 'ACTIVE', leftAt: null },
        });
        await prisma.notificationPreference.upsert({
            where: { userId_event: { userId, event: 'CLUB_ARCHIVED' } },
            create: { userId, event: 'CLUB_ARCHIVED', inApp: true, email: true },
            update: { email: true },
        });
        send.mockReset().mockResolvedValue(randomUUID());
        log.mockClear();
    });
    afterAll(async () => {
        await removeUsers(prisma, [userId]);
        await prisma.$disconnect();
    });

    it('should claim each opted-in intent once across concurrent processes and persist provider acceptance', async () => {
        const notification = (await record())!;
        await Promise.all(Array.from({ length: 8 }, () => buildDispatcher().runOnce()));
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]![0]).toMatchObject({
            notificationId: notification.id,
            idempotencyKey: `notification/${notification.id}`,
            replyTo: 'hello@pick-flick.app',
        });
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'ACCEPTED',
            attemptCount: 1,
            leaseUntil: null,
        });
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|example.invalid|html|subject/);
    });

    it('should retry temporary failure after backoff with exactly the same key and payload after a restart', async () => {
        const notification = (await record())!;
        send.mockRejectedValueOnce(new EmailDeliveryError('network_or_timeout', true));
        await buildDispatcher().runOnce();
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'PENDING',
            attemptCount: 1,
        });
        await buildDispatcher().runOnce();
        expect(send).toHaveBeenCalledTimes(1);
        const due = (await getDelivery(notification.id)).nextAttemptAt;
        await buildDispatcher().runOnce(due);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'ACCEPTED',
            attemptCount: 2,
        });
    });

    it('should recover an abandoned lease and fence the old worker result', async () => {
        const notification = (await record())!;
        const now = new Date();
        const abandoned = (await claimEmail(prisma, now))!;
        await buildDispatcher().runOnce();
        expect(send).not.toHaveBeenCalled();
        await buildDispatcher().runOnce(new Date(now.getTime() + 120_001));
        expect(send).toHaveBeenCalledTimes(1);
        expect(
            await finishEmail(prisma, { claim: abandoned, status: 'FAILED', reason: 'stale' }),
        ).toBe(false);
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'ACCEPTED',
            attemptCount: 2,
        });
    });

    it('should stop unknown delivery outside the idempotency window and attempt one non-recursive alert', async () => {
        const notification = (await record())!;
        const abandoned = (await claimEmail(prisma, new Date()))!;
        send.mockRejectedValue(new EmailDeliveryError('provider_503', true));
        await buildDispatcher().runOnce(
            new Date(abandoned.firstAttemptAt.getTime() + 24 * 60 * 60 * 1000),
        );
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'FAILED',
            reason: 'retry_window_exhausted',
            alertSentAt: null,
        });
        expect((await getDelivery(notification.id)).alertAttemptedAt).not.toBeNull();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]![0].notificationId).toBeUndefined();
        await buildDispatcher().runOnce();
        expect(send).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith({
            event: 'email.alert_failed',
            notificationId: notification.id,
        });
    });

    it('should stop after six failed sends and retain every failed attempt', async () => {
        const notification = (await record())!;
        send.mockImplementation((message) =>
            message.notificationId
                ? Promise.reject(new EmailDeliveryError('provider_429', true))
                : Promise.resolve(randomUUID()),
        );
        await buildDispatcher().runOnce();
        for (let attempt = 1; attempt < 6; attempt++)
            await buildDispatcher().runOnce((await getDelivery(notification.id)).nextAttemptAt);
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'FAILED',
            attemptCount: 6,
        });
        expect(send).toHaveBeenCalledTimes(7);
        expect((await getDelivery(notification.id)).alertSentAt).not.toBeNull();
    });

    it('should fail when the provider refuses a retry under the same idempotency key', async () => {
        const notification = (await record())!;
        send.mockRejectedValueOnce(new EmailDeliveryError('network_or_timeout', true));
        await buildDispatcher().runOnce();
        send.mockRejectedValueOnce(new EmailDeliveryError('provider_409', false));
        await buildDispatcher().runOnce((await getDelivery(notification.id)).nextAttemptAt);
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'FAILED',
            reason: 'provider_409',
            attemptCount: 2,
        });
        expect(send.mock.calls[0]![0].idempotencyKey).toBe(send.mock.calls[1]![0].idempotencyKey);
    });

    it('should fail permanent rejection immediately and alert the configured operator inbox', async () => {
        const notification = (await record())!;
        send.mockRejectedValueOnce(new EmailDeliveryError('provider_403', false));
        await buildDispatcher().runOnce();
        expect(await getDelivery(notification.id)).toMatchObject({
            status: 'FAILED',
            attemptCount: 1,
            reason: 'provider_403',
        });
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1]![0]).toMatchObject({
            to: environment.alertTo,
            idempotencyKey: `notification-alert/${notification.id}`,
        });
    });

    it('should honor captured preferences and mandatory notices while disabled and preview modes leave work pending', async () => {
        await prisma.notificationPreference.update({
            where: { userId_event: { userId, event: 'CLUB_ARCHIVED' } },
            data: { email: false },
        });
        const optional = (await record())!;
        const mandatory = (await record('BILLING_SERVICE'))!;
        expect(
            await prisma.notificationEmailDelivery.findUnique({
                where: { notificationId: optional.id },
            }),
        ).toBeNull();
        await buildDispatcher(false).runOnce();
        expect(await getDelivery(mandatory.id)).toMatchObject({
            status: 'PENDING',
            attemptCount: 0,
        });
        expect(send).not.toHaveBeenCalled();
        await buildDispatcher().runOnce();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0]![0].text).toContain('required service notice');
    });

    it('should remove links after access loss and suppress inactive users and suppressed addresses', async () => {
        await record();
        await prisma.membership.updateMany({
            where: { clubId, userId },
            data: { status: 'LEFT', leftAt: new Date() },
        });
        await buildDispatcher().runOnce();
        expect(send.mock.calls[0]![0].html).not.toContain(`/clubs/${clubId}`);
        expect(send.mock.calls[0]![0].subject).toContain('no longer available');
        const suspended = (await record('BILLING_SERVICE'))!;
        await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
        await buildDispatcher().runOnce();
        expect(await getDelivery(suspended.id)).toMatchObject({
            status: 'SUPPRESSED',
            reason: 'recipient_ineligible',
        });
        await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
        const suppressed = (await record('BILLING_SERVICE'))!;
        await prisma.notificationEmailSuppression.create({
            data: {
                addressHash: hashEmailAddress(`it-${userId}@example.invalid`),
                reason: 'email.bounced',
            },
        });
        await buildDispatcher().runOnce();
        expect(await getDelivery(suppressed.id)).toMatchObject({
            status: 'SUPPRESSED',
            reason: 'address_suppressed',
        });
        expect(send).toHaveBeenCalledTimes(1);
    });
});
