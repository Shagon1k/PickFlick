import { createHmac, randomUUID } from 'node:crypto';

import { createUser, type ITestApi, startTestApi } from '../../../../testing/integration.js';
import { removeUsers } from '../../../../testing/remove-users.js';
import type { IEmailMessage } from '../../../email/email.types.js';
import { recordNotification } from '../../notification-store.js';
import { EmailDispatcher } from '../email-dispatcher.js';
import { hashEmailAddress } from '../email-store.js';

const WEBHOOK_SECRET = 'pf62-synthetic-webhook-only';

describe('EmailWebhook', () => {
    let api: ITestApi;
    let userId: string;
    let notificationId: string;
    let providerId: string;
    const environment = {
        databaseUrl: 'unused',
        baseUrl: 'https://uat.pick-flick.app',
        from: 'PickFlick UAT <uat@pick-flick.app>',
        apiKey: 'synthetic-only',
        deliveryEnabled: true,
        alertTo: 'test@pick-flick.app',
    };
    const send = vi.fn<(message: IEmailMessage) => Promise<string>>();
    const log = vi.fn();
    const buildDispatcher = () => new EmailDispatcher(api.prisma, { send }, { environment, log });
    const getDelivery = () =>
        api.prisma.notificationEmailDelivery.findUniqueOrThrow({ where: { notificationId } });
    const record = () =>
        api.prisma.$transaction((tx) =>
            recordNotification(tx, {
                recipientId: userId,
                event: 'BILLING_SERVICE',
                sourceId: randomUUID(),
            }),
        );
    const buildPayload = (type = 'email.delivered') =>
        JSON.stringify({
            type,
            created_at: new Date().toISOString(),
            data: {
                email_id: providerId,
                to: [`it-${userId}@example.invalid`],
                tags: { notification_id: notificationId },
                subject: 'PRIVATE SUBJECT',
                from: 'uat@pick-flick.app',
            },
        });
    const sign = (
        body: string,
        timestamp = String(Math.floor(Date.now() / 1000)),
        id = `msg_${randomUUID()}`,
    ) => {
        const signature = createHmac('sha256', Buffer.from(WEBHOOK_SECRET))
            .update(`${id}.${timestamp}.${body}`)
            .digest('base64');
        return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
    };
    const post = (body: string, headers = sign(body)) =>
        api.request('/webhooks/resend', {
            method: 'POST',
            body,
            headers: { 'content-type': 'application/json', ...headers },
        });
    beforeAll(async () => {
        vi.stubEnv(
            'RESEND_WEBHOOK_SECRET',
            `whsec_${Buffer.from(WEBHOOK_SECRET).toString('base64')}`,
        );
        api = await startTestApi();
        userId = await createUser(api.prisma);
    });
    beforeEach(async () => {
        await api.prisma.notification.deleteMany({ where: { recipientId: userId } });
        await api.prisma.notificationEmailSuppression.deleteMany({
            where: { addressHash: hashEmailAddress(`it-${userId}@example.invalid`) },
        });
        providerId = randomUUID();
        send.mockReset().mockResolvedValue(providerId);
        notificationId = (await record())!.id;
    });
    afterAll(async () => {
        await removeUsers(api.prisma, [userId]);
        await api.close();
        vi.unstubAllEnvs();
    });

    it('should reject unsigned, modified, stale and malformed requests without requiring a browser session', async () => {
        const body = buildPayload();
        await api.expectStatus(401, '/webhooks/resend', { method: 'POST', json: JSON.parse(body) });
        expect((await post(body.replace('PRIVATE SUBJECT', 'changed'), sign(body))).status).toBe(
            401,
        );
        expect((await post(body, sign(body, '1'))).status).toBe(401);
        expect((await post(JSON.stringify({ type: 'email.delivered', data: {} }))).status).toBe(
            400,
        );
        expect((await getDelivery()).status).toBe('PENDING');
    });

    it('should confirm delivery, acknowledge duplicate receipt IDs, and ignore later sent or delayed events', async () => {
        await buildDispatcher().runOnce();
        const body = buildPayload();
        const headers = sign(body);
        expect((await post(body, headers)).status).toBe(204);
        expect((await post(body, headers)).status).toBe(204);
        expect((await getDelivery()).status).toBe('DELIVERED');
        expect(
            await api.prisma.notificationEmailWebhook.count({ where: { id: headers['svix-id'] } }),
        ).toBe(1);
        expect((await post(buildPayload('email.sent'))).status).toBe(204);
        expect((await post(buildPayload('email.delivery_delayed'))).status).toBe(204);
        expect((await getDelivery()).status).toBe('DELIVERED');
    });

    it('should correlate a callback arriving before the send response and preserve its result', async () => {
        send.mockImplementationOnce(async () => {
            expect((await post(buildPayload())).status).toBe(204);
            return providerId;
        });
        await buildDispatcher().runOnce();
        expect(await getDelivery()).toMatchObject({
            status: 'DELIVERED',
            providerId,
            attemptCount: 1,
        });
        await buildDispatcher().runOnce();
        expect(send).toHaveBeenCalledTimes(1);
    });

    it.each(['email.bounced', 'email.complained', 'email.suppressed'])(
        'should persist %s, alert once, and suppress future mandatory mail to the same address',
        async (type) => {
            await buildDispatcher().runOnce();
            expect((await post(buildPayload(type))).status).toBe(204);
            expect(await getDelivery()).toMatchObject({ status: 'SUPPRESSED', reason: type });
            expect((await post(buildPayload())).status).toBe(204);
            expect((await getDelivery()).status).toBe('SUPPRESSED');
            await Promise.all([buildDispatcher().runOnce(), buildDispatcher().runOnce()]);
            expect((await getDelivery()).alertSentAt).not.toBeNull();
            const next = (await record())!;
            await buildDispatcher().runOnce();
            expect(
                await api.prisma.notificationEmailDelivery.findUniqueOrThrow({
                    where: { notificationId: next.id },
                }),
            ).toMatchObject({ status: 'SUPPRESSED', reason: 'address_suppressed' });
            expect(send).toHaveBeenCalledTimes(2);
            expect(JSON.stringify(log.mock.calls)).not.toMatch(/example.invalid|PRIVATE SUBJECT/);
        },
    );

    it('should retain provider final failures without retrying or regressing to delivered', async () => {
        await buildDispatcher().runOnce();
        expect((await post(buildPayload('email.failed'))).status).toBe(204);
        expect((await post(buildPayload())).status).toBe(204);
        expect(await getDelivery()).toMatchObject({ status: 'FAILED', reason: 'email.failed' });
        await buildDispatcher().runOnce();
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1]![0].notificationId).toBeUndefined();
    });

    it('should acknowledge unrelated provider events and reject recipient mismatches as correlations', async () => {
        await buildDispatcher().runOnce();
        const body = buildPayload().replace(
            `it-${userId}@example.invalid`,
            'other@example.invalid',
        );
        expect((await post(body)).status).toBe(204);
        expect((await post(JSON.stringify({ type: 'domain.updated' }))).status).toBe(204);
        expect((await getDelivery()).status).toBe('ACCEPTED');
    });
});
