import {
    getRewrittenUrl,
    isRewrite,
    unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { config, proxy } from '@/proxy';

describe('preview route proxy', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('should run only for the internal preview routes', () => {
        expect(unstable_doesMiddlewareMatch({ config, url: '/ui-preview' })).toBe(true);
        expect(unstable_doesMiddlewareMatch({ config, url: '/shell-preview/product' })).toBe(true);
        expect(unstable_doesMiddlewareMatch({ config, url: '/pricing' })).toBe(false);
    });

    it('should hide previews in production and serve them elsewhere', () => {
        vi.stubEnv('APP_ENV', 'production');
        const hidden = proxy(new NextRequest('https://pick-flick.app/ui-preview/error-recovery'));
        expect(isRewrite(hidden)).toBe(true);
        expect(getRewrittenUrl(hidden)).toBe('https://pick-flick.app/__preview-unavailable');

        vi.stubEnv('APP_ENV', 'uat');
        expect(isRewrite(proxy(new NextRequest('https://uat.pick-flick.app/ui-preview')))).toBe(
            false,
        );
    });
});
