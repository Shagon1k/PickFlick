import 'server-only';

import { resolveAuthReturnTarget } from '@pickflick/contracts';
import { headers } from 'next/headers';

import { buildVisitorHeaders } from '@/lib/api.server';

const SESSION_CHECK_TIMEOUT_MS = 2_000;

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001';

/**
 * `unavailable` means the API could not answer (timeout, rate limit, or outage). Pages decide how
 * to show it; it never silently means signed out.
 */
export type TSessionState = 'anonymous' | 'authenticated' | 'unavailable';

export async function getSessionState(): Promise<TSessionState> {
    const incoming = await headers();
    const cookie = incoming.get('cookie');
    if (!cookie) {
        return 'anonymous';
    }
    try {
        const response = await fetch(new URL('/api/auth/get-session', BACKEND_URL), {
            cache: 'no-store',
            headers: buildVisitorHeaders(incoming),
            signal: AbortSignal.timeout(SESSION_CHECK_TIMEOUT_MS),
        });
        if (!response.ok) {
            return 'unavailable';
        }
        const session = (await response.json()) as { user?: { id?: unknown } } | null;
        return typeof session?.user?.id === 'string' ? 'authenticated' : 'anonymous';
    } catch {
        return 'unavailable';
    }
}

/** Login URL that returns to `path` when it is an allowed target, otherwise to `/app`. */
export function buildLoginPath(path: string): string {
    return `/login?returnTo=${resolveAuthReturnTarget(path)}`;
}

export function isAppleSignInEnabled(): boolean {
    return process.env.APPLE_SIGN_IN_ENABLED === 'true';
}
