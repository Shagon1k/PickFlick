import { DEFAULT_AUTH_RETURN_TARGET, resolveAuthReturnTarget } from '../return-target.js';

describe('resolveAuthReturnTarget', () => {
    it.each([
        '/app',
        '/library',
        '/library?tab=my-ratings&q=Alien&score=8',
        '/library?tab=watchlist&q=Alien+%26+Aliens&priority=HIGH&sort=title&page=2',
        '/library?tab=my-ratings&q=&score=&priority=&sort=default&page=1',
        '/movies/10000000-0000-4000-8000-000000000031',
        '/sessions/30000000-0000-4000-8000-000000000040',
        '/clubs/10000000-0000-4000-8000-000000000031/sessions/new',
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
        '/library/extra',
        '/library#filters',
        '/library?next=//evil.example',
        '/library?tab=unknown',
        '/library?score=11',
        '/library?priority=unknown',
        '/library?sort=unknown',
        '/library?page=-1',
        '/library?q=Alien&q=Aliens',
        `/library?q=${'x'.repeat(201)}`,
        '/movies/not-a-uuid',
        '/sessions/not-a-uuid',
        '/sessions/30000000-0000-4000-8000-000000000040?next=//evil.example',
        '/clubs/10000000-0000-4000-8000-000000000031/sessions/new/extra',
        '/movies/10000000-0000-4000-8000-000000000031?next=//evil.example',
        '/invite/club/token/extra',
        '/clubs/not-a-uuid/settings',
        '/clubs/not-a-uuid',
        null,
    ])('should fall back for %s', (target) => {
        expect(resolveAuthReturnTarget(target)).toBe(DEFAULT_AUTH_RETURN_TARGET);
    });
});
