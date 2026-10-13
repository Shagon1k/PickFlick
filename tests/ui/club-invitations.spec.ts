import { type BrowserContext, expect, test } from '@playwright/test';

import { settle } from './settle';
import { screenshotViewports } from './viewports';
const tokens = {
    valid: 'v',
    expired: 'e',
    revoked: 'r',
    full: 'f',
    member: 'm',
    paused: 'p',
    invalid: 'i',
    error: 'z',
};
const titles = {
    valid: 'You are invited',
    expired: 'Invitation expired',
    revoked: 'Invitation revoked',
    full: 'The Club is full',
    member: 'You are already a member',
    paused: 'Invitations are paused',
    invalid: 'Invitation unavailable',
    error: 'Please try again',
};
const invitationPath = (state: keyof typeof tokens = 'valid') =>
    `/invite/club/${tokens[state].repeat(43)}`;
async function signIn(context: BrowserContext, name: string) {
    await context.addCookies([
        {
            name: 'pickflick.session_token',
            value: `valid-invitation-${name}`,
            url: 'http://127.0.0.1:41730',
        },
    ]);
}
for (const viewport of screenshotViewports) {
    for (const state of [
        'valid',
        'expired',
        'revoked',
        'full',
        'member',
        'paused',
        'invalid',
        'error',
        'sign-in',
    ] as const) {
        test(
            `Club invitation ${state} at ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await page.setViewportSize(viewport);
                await context.addCookies([
                    {
                        name: 'pickflick.session_token',
                        value:
                            state === 'sign-in'
                                ? 'forged'
                                : `valid-visual-${state}-${viewport.name}`,
                        url: 'http://127.0.0.1:41730',
                    },
                ]);
                await page.goto(invitationPath(state === 'sign-in' ? 'valid' : state), {
                    waitUntil: 'load',
                });
                await expect(
                    page.getByRole('heading', {
                        name: state === 'sign-in' ? 'Your invitation awaits' : titles[state],
                    }),
                ).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(
                    `club-invitation-${state}-${viewport.name}.png`,
                    { fullPage: true, scale: 'css' },
                );
            },
        );
    }
}
for (const viewport of screenshotViewports) {
    for (const decision of ['accept', 'decline'] as const) {
        test(
            `Club invitation ${decision} outcome at ${viewport.name}`,
            { tag: '@visual' },
            async ({ context, page }) => {
                await page.setViewportSize(viewport);
                await signIn(context, `visual-${decision}-${viewport.name}`);
                await page.goto(invitationPath());
                await page
                    .getByRole('button', {
                        name: decision === 'accept' ? 'Accept Invitation' : "No thanks, I'll pass",
                    })
                    .click();
                await expect(
                    page.getByRole('heading', {
                        name: decision === 'accept' ? 'Welcome to the Club' : 'Invitation declined',
                    }),
                ).toBeVisible();
                await settle(page);
                await expect(page).toHaveScreenshot(
                    `club-invitation-${decision}-${viewport.name}.png`,
                    { fullPage: true, scale: 'css' },
                );
            },
        );
    }
}
