import nextConfig from '../../../next.config';
import { buildContentSecurityPolicy, SECURITY_HEADERS } from '../security-headers';

describe('buildContentSecurityPolicy', () => {
    it('should allow scripts only with the nonce and forbid framing', () => {
        const policy = buildContentSecurityPolicy('abc123', false);

        expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
        expect(policy).toContain("frame-ancestors 'none'");
        expect(policy).toContain("object-src 'none'");
        expect(policy).not.toContain('unsafe-eval');
    });

    it('should restrict images and connections to our own origin', () => {
        const policy = buildContentSecurityPolicy('abc123', false);
        expect(policy).toContain("img-src 'self' data: blob:;");
        expect(policy.replace('frame-src https://www.youtube-nocookie.com', '')).not.toContain(
            'https://',
        );
        expect(policy).toContain("connect-src 'self'");
        expect(policy).toContain("default-src 'self'");
        expect(policy).not.toContain('https:;');
    });

    it('should allow frames only from the privacy-enhanced YouTube player', () => {
        expect(buildContentSecurityPolicy('abc123', false)).toContain(
            'frame-src https://www.youtube-nocookie.com;',
        );
    });

    it('should allow eval only in development', () => {
        expect(buildContentSecurityPolicy('abc123', true)).toContain("'unsafe-eval'");
    });
});

describe('SECURITY_HEADERS', () => {
    it('should apply to every route', async () => {
        const headers = await nextConfig.headers?.();

        expect(headers).toContainEqual({ headers: [...SECURITY_HEADERS], source: '/:path*' });
    });
});
