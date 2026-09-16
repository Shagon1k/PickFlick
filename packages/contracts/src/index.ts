export const SERVICE_NAMES = {
  api: "api",
  web: "web",
  worker: "worker",
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export interface ServiceStatus {
  readonly service: ServiceName;
  readonly status: "scaffold";
}

export const DEPENDENCY_NAMES = ["database", "redis", "objectStorage"] as const;
export type DependencyName = (typeof DEPENDENCY_NAMES)[number];

export interface LivenessReport {
  readonly service: ServiceName;
  readonly status: "alive";
  readonly revision?: string;
}

export interface DependencyStatus {
  readonly name: DependencyName;
  readonly status: "up" | "down";
}

export interface ReadinessReport {
  readonly status: "ready" | "not_ready";
  readonly checks: readonly DependencyStatus[];
}

export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "REQUEST_FAILED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

export const CONTACT_MESSAGE_MAX_LENGTH = 500;
export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

export interface ContactSubmissionRequest {
  readonly submissionKey: string;
  readonly message: string;
  readonly name?: string;
  readonly email?: string;
}

export interface ContactSubmissionResponse {
  readonly id: string;
  readonly status: "accepted" | "duplicate";
}

export const DEFAULT_AUTH_RETURN_TARGET = "/app";

const invitationAuthReturnTarget = /^\/invite\/(?:club|session)\/[A-Za-z0-9_-]{1,512}$/;

export function isAllowedAuthReturnTarget(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 600 || !value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (character === "\\" || codePoint <= 31 || codePoint === 127) {
      return false;
    }
  }
  return value === DEFAULT_AUTH_RETURN_TARGET || invitationAuthReturnTarget.test(value);
}

export function resolveAuthReturnTarget(value: unknown): string {
  return isAllowedAuthReturnTarget(value) ? value : DEFAULT_AUTH_RETURN_TARGET;
}
