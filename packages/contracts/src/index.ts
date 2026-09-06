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
