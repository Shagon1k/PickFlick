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
