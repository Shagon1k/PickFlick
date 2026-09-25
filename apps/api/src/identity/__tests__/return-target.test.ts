import { describe, expect, it } from 'vitest';

import {
    DEFAULT_AUTH_RETURN_TARGET,
    isAllowedAuthReturnTarget,
    resolveAuthReturnTarget,
} from '../return-target.js';

describe('authentication return targets', () => {
    it.each([
        '/app',
        '/invite/club/invite_token-123',
        '/invite/session/invite_token-123',
        '/clubs/new',
        '/clubs/10000000-0000-4000-8000-000000000031/settings',
    ])('accepts the supported relative target %s', (target) => {
        expect(isAllowedAuthReturnTarget(target)).toBe(true);
        expect(resolveAuthReturnTarget(target)).toBe(target);
    });

    it.each([
        'https://evil.example/app',
        '//evil.example/app',
        '/\\evil.example/app',
        '/app?next=https://evil.example',
        '/app#fragment',
        '/admin',
        '/invite/club/',
        '/invite/club/token/extra',
        '/invite/session/token%2Fextra',
        '/clubs/not-a-uuid/settings',
        '/clubs/10000000-0000-4000-8000-000000000031',
        '/clubs/10000000-0000-4000-8000-000000000031/settings/extra',
        null,
        undefined,
    ])('rejects an unsafe, malformed, or unauthorized target: %s', (target) => {
        expect(isAllowedAuthReturnTarget(target)).toBe(false);
        expect(resolveAuthReturnTarget(target)).toBe(DEFAULT_AUTH_RETURN_TARGET);
    });
});
