import type { BetterAuthPlugin } from "better-auth";
import { isAllowedAuthReturnTarget } from "@pickflick/contracts";

const safeAuthenticationErrors = new Set([
  "access_denied",
  "account_not_linked",
  "google_email_not_verified",
  "state_mismatch",
  "state_not_found",
]);

export function sanitizeAuthenticationRedirect(location: string, baseUrl: string): string {
  const loginUrl = new URL("/login", baseUrl);
  const redirectUrl = new URL(location, baseUrl);
  if (redirectUrl.origin !== loginUrl.origin || redirectUrl.pathname !== loginUrl.pathname) {
    return location;
  }

  const error = redirectUrl.searchParams.get("error");
  if (!error) {
    return location;
  }

  const returnTo = redirectUrl.searchParams.get("returnTo");
  if (isAllowedAuthReturnTarget(returnTo)) {
    loginUrl.searchParams.set("returnTo", returnTo);
  }
  loginUrl.searchParams.set("error", safeAuthenticationErrors.has(error) ? error : "authentication_failed");
  return loginUrl.toString();
}

export function safeAuthenticationResponsePlugin(baseUrl: string): BetterAuthPlugin {
  return {
    id: "pickflick-safe-authentication-response",
    async onResponse(response) {
      const location = response.headers.get("location");
      if (!location) {
        return;
      }

      const sanitizedLocation = sanitizeAuthenticationRedirect(location, baseUrl);
      if (sanitizedLocation === location) {
        return;
      }

      const headers = new Headers(response.headers);
      headers.set("location", sanitizedLocation);
      return {
        response: new Response(response.body, {
          headers,
          status: response.status,
          statusText: response.statusText,
        }),
      };
    },
  };
}
