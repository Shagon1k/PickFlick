import { expect, test } from '@playwright/test';

import { seedFixture } from './backend-fixture';
import { settle } from './settle';

const publicRoutes = ['/', '/pricing', '/contact', '/legal/privacy', '/login', '/ui-preview'];

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        const violations: string[] = [];
        Object.assign(globalThis, { cspViolations: violations });
        globalThis.addEventListener('securitypolicyviolation', (event) => {
            violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
        });
    });
});

test(
    'pages send the security headers and a fresh CSP nonce',
    { tag: '@smoke' },
    async ({ page }) => {
        const first = await page.goto('/');
        const second = await page.goto('/');
        const headers = first?.headers() ?? {};

        expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+'/u);
        expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(second?.headers()['content-security-policy']).not.toBe(
            headers['content-security-policy'],
        );
        expect(headers['strict-transport-security']).toBe('max-age=31536000');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    },
);

test(
    'pages sign every inline script and raise no CSP violations',
    { tag: '@smoke' },
    async ({ context, page }) => {
        const fixture = await seedFixture(context);
        const signedInRoutes = ['/app', '/clubs/new', `/clubs/${fixture.clubId}/settings`];
        for (const route of [...publicRoutes, ...signedInRoutes]) {
            await page.goto(route, { waitUntil: 'load' });
            await settle(page);

            // Inline scripts need the nonce; chunks that trusted scripts load pass via strict-dynamic.
            const unsigned = await page.evaluate(
                () =>
                    [...globalThis.document.scripts].filter(
                        (script) => !script.src && !script.nonce,
                    ).length,
            );
            const violations = await page.evaluate(
                () => (globalThis as unknown as { cspViolations: string[] }).cspViolations,
            );
            expect({ route, unsigned, violations }).toEqual({ route, unsigned: 0, violations: [] });
        }
    },
);
