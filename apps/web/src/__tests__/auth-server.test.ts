import { describe, expect, it, vi } from "vitest";

import { hasAuthenticatedSession, isAppleSignInEnabled } from "../auth-server";

describe("authentication server state", () => {
  it("enables Apple actions only for the exact enabled value", () => {
    expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: "true" })).toBe(true);
    expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: "false" })).toBe(false);
    expect(isAppleSignInEnabled({})).toBe(false);
  });

  it("recognizes only a successful API session with a User id", async () => {
    const authenticatedFetch = vi.fn<
      (input: string | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({ user: { id: "user-1" } }));
    const anonymousFetch = vi.fn<
      (input: string | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json(null));

    await expect(hasAuthenticatedSession(
      new Headers({
        "cf-connecting-ip": "203.0.113.42",
        cookie: "pickflick.session_token=valid",
        "x-untrusted-header": "do-not-forward",
      }),
      { BACKEND_INTERNAL_URL: "http://api:3001" },
      authenticatedFetch,
    )).resolves.toBe(true);
    await expect(hasAuthenticatedSession(
      new Headers({ cookie: "pickflick.session_token=forged" }),
      { BACKEND_INTERNAL_URL: "http://api:3001" },
      anonymousFetch,
    )).resolves.toBe(false);
    await expect(hasAuthenticatedSession(new Headers(), {}, authenticatedFetch)).resolves.toBe(false);
    expect(authenticatedFetch).toHaveBeenCalledOnce();

    const request = authenticatedFetch.mock.calls[0]?.[1];
    const forwardedHeaders = new Headers(request?.headers);
    expect(forwardedHeaders.get("cookie")).toBe("pickflick.session_token=valid");
    expect(forwardedHeaders.get("cf-connecting-ip")).toBe("203.0.113.42");
    expect(forwardedHeaders.has("x-untrusted-header")).toBe(false);
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps Login available when the session API is unavailable", async () => {
    await expect(hasAuthenticatedSession(
      new Headers({ cookie: "pickflick.session_token=unknown" }),
      {},
      async () => { throw new Error("unavailable"); },
    )).resolves.toBe(false);
  });
});
