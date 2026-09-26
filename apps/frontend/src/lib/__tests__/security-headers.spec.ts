import nextConfig from '../../../next.config';
import { contentSecurityPolicy, SECURITY_HEADERS } from '../security-headers';

describe('contentSecurityPolicy', () => {
    it('should allow scripts only with the nonce and forbid framing', () => {
        const policy = contentSecurityPolicy('abc123', false);

        expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
        expect(policy).toContain("frame-ancestors 'none'");
        expect(policy).toContain("object-src 'none'");
        expect(policy).not.toContain('unsafe-eval');
    });

    it('should allow eval only in development', () => {
        expect(contentSecurityPolicy('abc123', true)).toContain("'unsafe-eval'");
    });
});

describe('SECURITY_HEADERS', () => {
    it('should apply to every route', async () => {
        const headers = await nextConfig.headers?.();

        expect(headers).toContainEqual({ headers: [...SECURITY_HEADERS], source: '/:path*' });
    });
});
