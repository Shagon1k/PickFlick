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
            await new ResendEmailClient({
                apiKey: 'synthetic-only',
                from: 'PickFlick UAT <uat@pick-flick.app>',
            }).send({
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
                new ResendEmailClient({
                    apiKey: 'synthetic-only',
                    from: 'sender@example.invalid',
                }).send({
                    to: 'test@example.invalid',
                    subject: 'Update',
                    text: 'Update',
                }),
            ).rejects.toMatchObject({ reason: `provider_${status}`, canRetry });
        },
    );

    it('should send local mail to each approved account with a local subject prefix', async () => {
        const recipients = ['first@example.invalid', 'second@example.invalid'];
        const client = new ResendEmailClient({
            apiKey: 'synthetic-only',
            from: 'sender@example.invalid',
            localDelivery: { recipients },
        });
        fetchProvider.mockImplementation(() =>
            Promise.resolve(Response.json({ id: randomUUID() })),
        );

        await client.send({ to: 'FIRST@EXAMPLE.INVALID', subject: 'First update', text: 'Update' });
        await client.send({ to: recipients[1]!, subject: 'Second update', text: 'Update' });

        expect(fetchProvider).toHaveBeenCalledTimes(2);
        expect(fetchProvider).toHaveBeenNthCalledWith(
            1,
            'https://api.resend.com/emails',
            expect.objectContaining({
                body: JSON.stringify({
                    from: 'sender@example.invalid',
                    to: 'FIRST@EXAMPLE.INVALID',
                    subject: '[LOCAL] First update',
                    text: 'Update',
                }),
            }),
        );
        expect(fetchProvider).toHaveBeenNthCalledWith(
            2,
            'https://api.resend.com/emails',
            expect.objectContaining({
                body: JSON.stringify({
                    from: 'sender@example.invalid',
                    to: 'second@example.invalid',
                    subject: '[LOCAL] Second update',
                    text: 'Update',
                }),
            }),
        );
    });

    it('should reject unapproved local recipients before contacting the provider', async () => {
        const client = new ResendEmailClient({
            apiKey: 'synthetic-only',
            from: 'sender@example.invalid',
            localDelivery: { recipients: ['approved@example.invalid'] },
        });

        await expect(
            client.send({ to: 'other@example.invalid', subject: 'Update', text: 'Update' }),
        ).rejects.toEqual(new EmailDeliveryError('local_recipient_not_allowed', false));
        expect(fetchProvider).not.toHaveBeenCalled();
    });

    it('should treat transport and malformed responses as uncertain retryable results', async () => {
        fetchProvider
            .mockRejectedValueOnce(new Error('PRIVATE timeout details'))
            .mockResolvedValueOnce(Response.json({ wrong: true }));
        const client = new ResendEmailClient({
            apiKey: 'synthetic-only',
            from: 'sender@example.invalid',
        });
        const message = { to: 'test@example.invalid', subject: 'Update', text: 'Update' };
        await expect(client.send(message)).rejects.toEqual(
            new EmailDeliveryError('network_or_timeout', true),
        );
        await expect(client.send(message)).rejects.toEqual(
            new EmailDeliveryError('invalid_response', true),
        );
    });
});
