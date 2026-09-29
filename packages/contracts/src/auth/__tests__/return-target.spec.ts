import { DEFAULT_AUTH_RETURN_TARGET, resolveAuthReturnTarget } from '../return-target.js';

describe('resolveAuthReturnTarget', () => {
    it.each([
        '/app',
        '/invite/club/invite_token-123',
        '/invite/session/invite_token-123',
        '/clubs/new',
        '/clubs/10000000-0000-4000-8000-000000000031',
        '/clubs/10000000-0000-4000-8000-000000000031/settings',
    ])('should keep the allowed target %s', (target) => {
        expect(resolveAuthReturnTarget(target)).toBe(target);
    });

    it.each([
        'https://evil.example/app',
        '//evil.example/app',
        '/\\evil.example/app',
        '/app?next=https://evil.example',
        '/admin',
        '/invite/club/token/extra',
        '/clubs/not-a-uuid/settings',
        '/clubs/not-a-uuid',
        null,
    ])('should fall back for %s', (target) => {
        expect(resolveAuthReturnTarget(target)).toBe(DEFAULT_AUTH_RETURN_TARGET);
    });
});
