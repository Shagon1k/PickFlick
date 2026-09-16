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

  it("does not alter non-error or non-Login redirects", () => {
    expect(sanitizeAuthenticationRedirect("/login", "http://127.0.0.1:3000")).toBe("/login");
    expect(sanitizeAuthenticationRedirect("/app", "http://127.0.0.1:3000")).toBe("/app");
  });
});
