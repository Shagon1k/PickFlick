import type { BrowserContext } from '@playwright/test';

/**
 * Signs a browser context in to the mock API. The token names the scenario the mock serves; add
 * a random suffix when the scenario keeps one-time state, so a retried test starts fresh.
 */
export async function signInMock(context: BrowserContext, token: string): Promise<void> {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: token,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ]);
}
