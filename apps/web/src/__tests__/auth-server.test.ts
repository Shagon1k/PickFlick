import { describe, expect, it, vi } from 'vitest';

import { isAppleSignInEnabled, loginPath, probeSession } from '../auth-server';

describe('authentication server state', () => {
    it('enables Apple actions only for the exact enabled value', () => {
        expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: 'true' })).toBe(true);
        expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: 'false' })).toBe(false);
        expect(isAppleSignInEnabled({})).toBe(false);
    });

    it('recognizes only a successful API session with a User id', async () => {
        const authenticatedFetch = vi.fn<
            (input: string | URL, init?: RequestInit) => Promise<Response>
        >(async () => Response.json({ user: { id: 'user-1' } }));
        const anonymousFetch = vi.fn<
            (input: string | URL, init?: RequestInit) => Promise<Response>
        >(async () => Response.json(null));

        await expect(
            probeSession(
                new Headers({
                    'cf-connecting-ip': '203.0.113.42',
                    cookie: 'pickflick.session_token=valid',
                    'x-untrusted-header': 'do-not-forward',
                }),
                { BACKEND_INTERNAL_URL: 'http://api:3001' },
                authenticatedFetch,
            ),
        ).resolves.toBe('authenticated');
        await expect(
            probeSession(
                new Headers({ cookie: 'pickflick.session_token=forged' }),
                { BACKEND_INTERNAL_URL: 'http://api:3001' },
                anonymousFetch,
            ),
        ).resolves.toBe('anonymous');
        await expect(probeSession(new Headers(), {}, authenticatedFetch)).resolves.toBe(
            'anonymous',
        );
        expect(authenticatedFetch).toHaveBeenCalledOnce();

        const request = authenticatedFetch.mock.calls[0]?.[1];
        const forwardedHeaders = new Headers(request?.headers);
        expect(forwardedHeaders.get('cookie')).toBe('pickflick.session_token=valid');
        expect(forwardedHeaders.get('cf-connecting-ip')).toBe('203.0.113.42');
        expect(forwardedHeaders.has('x-untrusted-header')).toBe(false);
        expect(request?.signal).toBeInstanceOf(AbortSignal);
    });

    it.each([
        [
            'a network failure',
            async () => {
                throw new Error('unavailable');
            },
        ],
        ['a rate limit', async () => new Response(null, { status: 429 })],
        ['an outage', async () => new Response(null, { status: 503 })],
    ])('reports %s as unavailable instead of signed out', async (_label, fetcher) => {
        await expect(
            probeSession(new Headers({ cookie: 'pickflick.session_token=unknown' }), {}, fetcher),
        ).resolves.toBe('unavailable');
    });

    it('builds Login URLs only for allowed return targets', () => {
        expect(loginPath('/clubs/new')).toBe('/login?returnTo=/clubs/new');
        expect(loginPath('/clubs/10000000-0000-4000-8000-000000000031/settings')).toBe(
            '/login?returnTo=/clubs/10000000-0000-4000-8000-000000000031/settings',
        );
        expect(loginPath('/clubs/NOT-A-UUID/settings')).toBe('/login?returnTo=/app');
    });
});
