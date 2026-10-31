import { randomUUID } from 'node:crypto';

import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';

import type { IJourneyBackend } from '../../apps/backend/src/testing/journeys.ts';

// Better Auth limits each client address (an IPv6 /64) per minute and keeps the counts in the
// database, so every visitor of every run gets its own documentation-range network.
const runNetwork = randomUUID().slice(0, 4);
let visitors = 0;

/** A browser context signed in as `userId`, with its own client address. */
export async function openVisitor(
    browser: Browser,
    backend: IJourneyBackend,
    userId: string,
    options: BrowserContextOptions = {},
): Promise<BrowserContext> {
    visitors += 1;
    const context = await browser.newContext({
        ...options,
        extraHTTPHeaders: { 'x-forwarded-for': `2001:db8:${runNetwork}:${visitors}::1` },
    });
    await context.addCookies(await backend.cookiesFor(userId, '127.0.0.1'));
    return context;
}
