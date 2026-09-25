import { describe, expect, it, vi } from 'vitest';

import { submitContactRequest } from '../contact-submission';

const payload = {
    submissionKey: '123e4567-e89b-42d3-a456-426614174000', // gitleaks:allow -- synthetic UUID fixture
    message: 'A concise message.',
};

describe('Contact Server Action API boundary', () => {
    it('forwards the submission and visitor chain without exposing the API response', async () => {
        const request = vi.fn<typeof fetch>(
            async () =>
                new Response(
                    JSON.stringify({
                        id: 'contact-1',
                        status: 'accepted',
                    }),
                    { status: 202 },
                ),
        );

        await expect(
            submitContactRequest(payload, {
                endpoint: new URL('http://api.example.invalid/contact'),
                forwardedFor: '203.0.113.42, 198.51.100.8',
                request,
            }),
        ).resolves.toEqual({ ok: true, status: 202 });
        expect(request).toHaveBeenCalledWith(
            new URL('http://api.example.invalid/contact'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'x-forwarded-for': '203.0.113.42, 198.51.100.8',
                }),
                body: JSON.stringify(payload),
            }),
        );
    });

    it('returns stable expected-error details', async () => {
        const request = vi.fn<typeof fetch>(
            async () =>
                new Response(
                    JSON.stringify({
                        error: {
                            code: 'RATE_LIMITED',
                            message: 'Too many requests.',
                            requestId: 'request-1',
                        },
                    }),
                    { status: 429 },
                ),
        );

        await expect(
            submitContactRequest(payload, {
                endpoint: new URL('http://api.example.invalid/contact'),
                request,
            }),
        ).resolves.toEqual({ code: 'RATE_LIMITED', ok: false, status: 429 });
    });
});
