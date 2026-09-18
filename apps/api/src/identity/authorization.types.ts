import type { IncomingHttpHeaders } from "node:http";
import type { AppRole } from "@pickflick/database";

export type { AppRole } from "@pickflick/database";

export const IDENTITY_AUTHORIZATION = Symbol("IDENTITY_AUTHORIZATION");
export const AUTHENTICATED_PRINCIPAL = Symbol("AUTHENTICATED_PRINCIPAL");
export const SSE_AUTHORIZATION_RECHECK_MILLISECONDS = Symbol("SSE_AUTHORIZATION_RECHECK_MILLISECONDS");

export interface AuthenticatedPrincipal {
  readonly appRole: AppRole;
  readonly sessionId: string;
  readonly userId: string;
}

export type SessionDenialReason = "inactive_user" | "invalid_session" | "service_unavailable";

export type IdentitySessionResolution =
  | { readonly authorized: true; readonly principal: AuthenticatedPrincipal }
  | { readonly authorized: false; readonly reason: SessionDenialReason };

export interface IdentityAuthorizationBoundary {
  resolveSession(headers: IncomingHttpHeaders): Promise<IdentitySessionResolution>;
}

export interface AuthenticatedRequest {
  readonly headers: IncomingHttpHeaders;
  [AUTHENTICATED_PRINCIPAL]?: AuthenticatedPrincipal;
}
