import type { BrowserContext, Page } from '@playwright/test';

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

/** Answers social sign-in with `reply` and returns a reader for the last request body it saw. */
export async function captureSocialSignIn(
    page: Page,
    reply: Record<string, unknown> = { redirect: false },
) {
    let body: Record<string, unknown> | undefined;
    await page.route('**/api/auth/sign-in/social', async (route) => {
        body = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ json: reply });
    });
    return () => body;
}
