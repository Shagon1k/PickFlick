interface AuthenticationEnvironment {
  readonly [name: string]: string | undefined;
  readonly APPLE_SIGN_IN_ENABLED?: string;
  readonly BACKEND_INTERNAL_URL?: string;
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type RequestHeaders = Pick<Headers, "get">;

const sessionProbeTimeoutMilliseconds = 2_000;

export function isAppleSignInEnabled(environment: AuthenticationEnvironment = process.env): boolean {
  return environment.APPLE_SIGN_IN_ENABLED === "true";
}

export async function hasAuthenticatedSession(
  requestHeaders: RequestHeaders,
  environment: AuthenticationEnvironment = process.env,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  const cookieHeader = requestHeaders.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  try {
    const backendUrl = new URL(environment.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001");
    const sessionHeaders = new Headers({ cookie: cookieHeader });
    const clientAddress = requestHeaders.get("cf-connecting-ip");
    if (clientAddress) {
      sessionHeaders.set("cf-connecting-ip", clientAddress);
    }
    const response = await fetcher(new URL("/api/auth/get-session", backendUrl), {
      cache: "no-store",
      headers: sessionHeaders,
      signal: AbortSignal.timeout(sessionProbeTimeoutMilliseconds),
    });
    if (!response.ok) {
      return false;
    }
    const session = await response.json() as unknown;
    if (!session || typeof session !== "object") {
      return false;
    }
    const user = (session as { user?: unknown }).user;
    return Boolean(user && typeof user === "object" && typeof (user as { id?: unknown }).id === "string");
  } catch {
    return false;
  }
}
