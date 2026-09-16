import { describe, expect, it } from "vitest";

import { sanitizeAuthenticationRedirect } from "../auth-response.js";

describe("authentication response sanitization", () => {
  it("keeps a stable error code and removes provider-supplied detail", () => {
    expect(
      sanitizeAuthenticationRedirect(
        "http://127.0.0.1:3000/login?error=access_denied&error_description=provider-secret-detail",
        "http://127.0.0.1:3000",
      ),
    ).toBe("http://127.0.0.1:3000/login?error=access_denied");
  });

  it("maps unknown errors to one generic code", () => {
    expect(
      sanitizeAuthenticationRedirect(
        "http://127.0.0.1:3000/login?error=provider-secret-detail",
        "http://127.0.0.1:3000",
      ),
    ).toBe("http://127.0.0.1:3000/login?error=authentication_failed");
  });

  it("preserves only an allowlisted return target on an error redirect", () => {
    expect(
      sanitizeAuthenticationRedirect(
        "http://127.0.0.1:3000/login?returnTo=%2Finvite%2Fclub%2Fsafe_token&error=access_denied",
        "http://127.0.0.1:3000",
      ),
    ).toBe("http://127.0.0.1:3000/login?returnTo=%2Finvite%2Fclub%2Fsafe_token&error=access_denied");
    expect(
      sanitizeAuthenticationRedirect(
        "http://127.0.0.1:3000/login?returnTo=https%3A%2F%2Funtrusted.example.invalid&error=access_denied",
        "http://127.0.0.1:3000",
      ),
    ).toBe("http://127.0.0.1:3000/login?error=access_denied");
  });

  it("does not alter non-error or non-Login redirects", () => {
    expect(sanitizeAuthenticationRedirect("/login", "http://127.0.0.1:3000")).toBe("/login");
    expect(sanitizeAuthenticationRedirect("/app", "http://127.0.0.1:3000")).toBe("/app");
  });
});
