import { resolveAuthReturnTarget } from '@pickflick/contracts';

interface AuthenticationEnvironment {
    readonly [name: string]: string | undefined;
    readonly APPLE_SIGN_IN_ENABLED?: string;
    readonly BACKEND_INTERNAL_URL?: string;
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type RequestHeaders = Pick<Headers, 'get'>;

const sessionProbeTimeoutMilliseconds = 2_000;

export function isAppleSignInEnabled(
    environment: AuthenticationEnvironment = process.env,
): boolean {
    return environment.APPLE_SIGN_IN_ENABLED === 'true';
}

/**
 * `unavailable` means the API could not answer (timeout, rate limit, or outage). Callers decide how
 * to present it; it never silently means signed out.
 */
export type SessionProbe = 'anonymous' | 'authenticated' | 'unavailable';

export async function probeSession(
    requestHeaders: RequestHeaders,
    environment: AuthenticationEnvironment = process.env,
    fetcher: Fetcher = fetch,
): Promise<SessionProbe> {
    const cookieHeader = requestHeaders.get('cookie');
    if (!cookieHeader) {
        return 'anonymous';
    }

    let response: Response;
    let session: unknown;
    try {
        const backendUrl = new URL(environment.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001');
        const sessionHeaders = new Headers({ cookie: cookieHeader });
        const clientAddress = requestHeaders.get('cf-connecting-ip');
        if (clientAddress) {
            sessionHeaders.set('cf-connecting-ip', clientAddress);
        }
        response = await fetcher(new URL('/api/auth/get-session', backendUrl), {
            cache: 'no-store',
            headers: sessionHeaders,
            signal: AbortSignal.timeout(sessionProbeTimeoutMilliseconds),
        });
        if (!response.ok) {
            return 'unavailable';
        }
        session = (await response.json()) as unknown;
    } catch {
        return 'unavailable';
    }
    if (!session || typeof session !== 'object') {
        return 'anonymous';
    }
    const user = (session as { user?: unknown }).user;
    return user && typeof user === 'object' && typeof (user as { id?: unknown }).id === 'string'
        ? 'authenticated'
        : 'anonymous';
}

/** Login URL that returns to `path` when it is an allowed return target, otherwise to `/app`. */
export function loginPath(path: string): string {
    return `/login?returnTo=${resolveAuthReturnTarget(path)}`;
}
