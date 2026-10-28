import { randomUUID } from 'node:crypto';

import { EmailDeliveryError, ResendEmailClient } from '../resend-email.client.js';

describe('ResendEmailClient', () => {
    const fetchProvider = vi.fn<typeof fetch>();
    beforeEach(() => {
        vi.stubGlobal('fetch', fetchProvider);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        fetchProvider.mockReset();
    });

    it('should send HTML and text with a bounded request, stable key, reply address and notification tag', async () => {
        const providerId = randomUUID();
        const notificationId = randomUUID();
        fetchProvider.mockResolvedValue(Response.json({ id: providerId }));
        expect(
            await new ResendEmailClient(
                'synthetic-only',
                'PickFlick UAT <uat@pick-flick.app>',
            ).send({
                to: 'test@pick-flick.app',
                subject: 'Update',
                text: 'Plain text',
                html: '<p>Update</p>',
                replyTo: 'hello@pick-flick.app',
                notificationId,
                idempotencyKey: `notification/${notificationId}`,
            }),
        ).toBe(providerId);
        expect(fetchProvider).toHaveBeenCalledWith(
            'https://api.resend.com/emails',
            expect.objectContaining({
                signal: expect.any(AbortSignal),
                method: 'POST',
                headers: expect.objectContaining({
                    'Idempotency-Key': `notification/${notificationId}`,
                }),
                body: JSON.stringify({
                    from: 'PickFlick UAT <uat@pick-flick.app>',
                    to: 'test@pick-flick.app',
                    subject: 'Update',
                    text: 'Plain text',
                    html: '<p>Update</p>',
                    reply_to: 'hello@pick-flick.app',
                    tags: [{ name: 'notification_id', value: notificationId }],
                }),
            }),
        );
    });

    it.each([
        [429, 'rate_limit_exceeded', true],
        [503, 'internal_server_error', true],
        [409, 'concurrent_idempotent_requests', true],
        [409, 'invalid_idempotent_request', false],
        [403, 'validation_error', false],
    ])(
        'should classify provider status %i (%s) without exposing its message',
        async (status, name, canRetry) => {
            fetchProvider.mockResolvedValue(
                Response.json({ name, message: 'PRIVATE provider content' }, { status }),
            );
            await expect(
                new ResendEmailClient('synthetic-only', 'sender@example.invalid').send({
                    to: 'test@example.invalid',
                    subject: 'Update',
                    text: 'Update',
                }),
            ).rejects.toMatchObject({ reason: `provider_${status}`, canRetry });
        },
    );

    it('should treat transport and malformed responses as uncertain retryable results', async () => {
        fetchProvider
            .mockRejectedValueOnce(new Error('PRIVATE timeout details'))
            .mockResolvedValueOnce(Response.json({ wrong: true }));
        const client = new ResendEmailClient('synthetic-only', 'sender@example.invalid');
        const message = { to: 'test@example.invalid', subject: 'Update', text: 'Update' };
        await expect(client.send(message)).rejects.toEqual(
            new EmailDeliveryError('network_or_timeout', true),
        );
        await expect(client.send(message)).rejects.toEqual(
            new EmailDeliveryError('invalid_response', true),
        );
    });
});
