import {
    getRewrittenUrl,
    isRewrite,
    unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';

import { ApiError } from '#lib/api.server';

import { config, proxy } from '../proxy';

const api = vi.hoisted(() => ({ getClubHub: vi.fn() }));
vi.mock('#api/clubs.server', () => api);

const CLUB_ID = '10000000-0000-4000-8000-000000000031';

describe('proxy', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        api.getClubHub.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('should run for pages but not for the API, static files, or prefetches', () => {
        expect(unstable_doesMiddlewareMatch({ config, url: '/pricing' })).toBe(true);
        expect(unstable_doesMiddlewareMatch({ config, url: '/clubs/1/settings' })).toBe(true);
        expect(unstable_doesMiddlewareMatch({ config, url: '/api/health' })).toBe(false);
        expect(unstable_doesMiddlewareMatch({ config, url: '/_next/static/app.js' })).toBe(false);
        expect(unstable_doesMiddlewareMatch({ config, url: '/robots.txt' })).toBe(false);
        expect(
            unstable_doesMiddlewareMatch({
                config,
                headers: { 'next-router-prefetch': '1' },
                url: '/pricing',
            }),
        ).toBe(false);
    });

    it('should still run for a prefetched preview', () => {
        expect(
            unstable_doesMiddlewareMatch({
                config,
                headers: { 'next-router-prefetch': '1' },
                url: '/ui-preview',
            }),
        ).toBe(true);
    });

    it('should give each page a fresh nonce in its policy and request headers', async () => {
        const first = await proxy(new NextRequest('https://pick-flick.app/pricing'));
        const second = await proxy(new NextRequest('https://pick-flick.app/pricing'));
        const policy = first.headers.get('Content-Security-Policy');

        expect(policy).toMatch(/'nonce-[A-Za-z0-9+/=]+'/u);
        expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
        expect(second.headers.get('Content-Security-Policy')).not.toBe(policy);
    });

    it('should save a direct Club visit only after the Hub authorizes the request', async () => {
        const request = new NextRequest(`https://pick-flick.app/clubs/${CLUB_ID}`, {
            headers: { cookie: 'pickflick.session_token=test-session' },
        });
        const response = await proxy(request);

        expect(api.getClubHub).toHaveBeenCalledWith(CLUB_ID, request.headers);
        expect(response.cookies.get('pickflick.last_club')?.value).toBe(CLUB_ID);
    });

    it.each([401, 404])('should preserve the last Club when the Hub returns %s', async (status) => {
        api.getClubHub.mockRejectedValueOnce(new ApiError(status));
        const request = new NextRequest(`https://pick-flick.app/clubs/${CLUB_ID}/settings`, {
            headers: { cookie: 'pickflick.last_club=previous-club' },
        });
        const response = await proxy(request);

        expect(response.cookies.get('pickflick.last_club')).toBeUndefined();
        expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    });

    it('should not query the Hub for Server Actions or an unchanged preference', async () => {
        const action = await proxy(
            new NextRequest(`https://pick-flick.app/clubs/${CLUB_ID}`, { method: 'POST' }),
        );
        const unchanged = await proxy(
            new NextRequest(`https://pick-flick.app/clubs/${CLUB_ID}/members`, {
                headers: { cookie: `pickflick.last_club=${CLUB_ID}` },
            }),
        );
        expect(api.getClubHub).not.toHaveBeenCalled();
        expect(action.cookies.get('pickflick.last_club')).toBeUndefined();
        expect(unchanged.cookies.get('pickflick.last_club')).toBeUndefined();
        expect(action.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    });

    it('should preserve the preference and report a failed authorization check', async () => {
        api.getClubHub.mockRejectedValueOnce(new TypeError('fetch failed'));
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const response = await proxy(
                new NextRequest(`https://pick-flick.app/clubs/${CLUB_ID}`),
            );

            expect(response.cookies.get('pickflick.last_club')).toBeUndefined();
            expect(log).toHaveBeenCalledWith('Club preference authorization failed.');
        } finally {
            log.mockRestore();
        }
    });

    it('should hide previews in production and serve them elsewhere', async () => {
        vi.stubEnv('APP_ENV', 'production');
        const hidden = await proxy(
            new NextRequest('https://pick-flick.app/ui-preview/error-recovery'),
        );
        expect(isRewrite(hidden)).toBe(true);
        expect(getRewrittenUrl(hidden)).toBe('https://pick-flick.app/__preview-unavailable');
        expect(hidden.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");

        vi.stubEnv('APP_ENV', 'uat');
        expect(
            isRewrite(await proxy(new NextRequest('https://uat.pick-flick.app/ui-preview'))),
        ).toBe(false);
    });
});
