import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';

const clubId = '10000000-0000-4000-8000-000000000031';
const publicRoutes = ['/', '/pricing', '/contact', '/legal/privacy', '/login', '/ui-preview'];
const signedInRoutes = ['/app', '/clubs/new', `/clubs/${clubId}/settings`];

async function authenticate(context: BrowserContext) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: 'valid-settings-admin-actions',
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        const violations: string[] = [];
        Object.assign(globalThis, { cspViolations: violations });
        globalThis.addEventListener('securitypolicyviolation', (event) => {
            violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
        });
    });
});

test('pages send the security headers and a fresh CSP nonce', async ({ page }) => {
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
});

test('pages sign every inline script and raise no CSP violations', async ({ context, page }) => {
    await authenticate(context);
    for (const route of [...publicRoutes, ...signedInRoutes]) {
        await page.goto(route, { waitUntil: 'load' });
        await settle(page);

        // Inline scripts need the nonce; chunks that trusted scripts load pass via strict-dynamic.
        const unsigned = await page.evaluate(
            () =>
                [...globalThis.document.scripts].filter((script) => !script.src && !script.nonce)
                    .length,
        );
        const violations = await page.evaluate(
            () => (globalThis as unknown as { cspViolations: string[] }).cspViolations,
        );
        expect({ route, unsigned, violations }).toEqual({ route, unsigned: 0, violations: [] });
    }
});
