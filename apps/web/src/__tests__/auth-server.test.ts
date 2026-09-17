import { describe, expect, it, vi } from "vitest";

import { hasAuthenticatedSession, isAppleSignInEnabled } from "../auth-server";

describe("authentication server state", () => {
  it("enables Apple actions only for the exact enabled value", () => {
    expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: "true" })).toBe(true);
    expect(isAppleSignInEnabled({ APPLE_SIGN_IN_ENABLED: "false" })).toBe(false);
    expect(isAppleSignInEnabled({})).toBe(false);
  });

  it("recognizes only a successful API session with a User id", async () => {
    const authenticatedFetch = vi.fn(async () => Response.json({ user: { id: "user-1" } }));
    const anonymousFetch = vi.fn(async () => Response.json(null));

    await expect(hasAuthenticatedSession(
      "pickflick.session_token=valid",
      { BACKEND_INTERNAL_URL: "http://api:3001" },
      authenticatedFetch,
    )).resolves.toBe(true);
    await expect(hasAuthenticatedSession(
      "pickflick.session_token=forged",
      { BACKEND_INTERNAL_URL: "http://api:3001" },
      anonymousFetch,
    )).resolves.toBe(false);
    await expect(hasAuthenticatedSession(null, {}, authenticatedFetch)).resolves.toBe(false);
    expect(authenticatedFetch).toHaveBeenCalledOnce();
  });

  it("keeps Login available when the session API is unavailable", async () => {
    await expect(hasAuthenticatedSession(
      "pickflick.session_token=unknown",
      {},
      async () => { throw new Error("unavailable"); },
    )).resolves.toBe(false);
  });
});
