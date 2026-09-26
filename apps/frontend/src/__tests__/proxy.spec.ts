import {
    getRewrittenUrl,
    isRewrite,
    unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';

import { config, proxy } from '@/proxy';

describe('proxy', () => {
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

    it('should give each page a fresh nonce in its policy and request headers', () => {
        const first = proxy(new NextRequest('https://pick-flick.app/pricing'));
        const second = proxy(new NextRequest('https://pick-flick.app/pricing'));
        const policy = first.headers.get('Content-Security-Policy');
        const nonce = first.headers.get('x-middleware-request-x-nonce');

        expect(nonce).toBeTruthy();
        expect(policy).toContain(`'nonce-${nonce}'`);
        expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
        expect(second.headers.get('Content-Security-Policy')).not.toBe(policy);
    });

    it('should hide previews in production and serve them elsewhere', () => {
        vi.stubEnv('APP_ENV', 'production');
        const hidden = proxy(new NextRequest('https://pick-flick.app/ui-preview/error-recovery'));
        expect(isRewrite(hidden)).toBe(true);
        expect(getRewrittenUrl(hidden)).toBe('https://pick-flick.app/__preview-unavailable');
        expect(hidden.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");

        vi.stubEnv('APP_ENV', 'uat');
        expect(isRewrite(proxy(new NextRequest('https://uat.pick-flick.app/ui-preview')))).toBe(
            false,
        );
    });
});
