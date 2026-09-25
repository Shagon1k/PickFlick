import type {
  ApiErrorEnvelope,
  ChangeClubMemberRoleRequest,
  ClubAvatarResponse,
  ClubCollectionResponse,
  ClubLifecycleRequest,
  ClubOperationReceipt,
  ClubOperationRequest,
  ClubSettingsProjection,
  ClubSummary,
  CreateClubRequest,
  CreateClubResponse,
  UpdateClubSettingsRequest,
  UpdateClubSettingsResponse,
} from "@pickflick/contracts";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type RequestHeaders = Pick<Headers, "get">;

export interface ClubApiResult<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly body?: T;
  readonly code?: string;
  readonly reason?: string;
}

function backendEndpoint(path: string): URL {
  return new URL(path, process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001");
}

function forwardingHeaders(requestHeaders: RequestHeaders): Headers {
  const result = new Headers();
  const cookie = requestHeaders.get("cookie");
  const clientAddress = requestHeaders.get("cf-connecting-ip");
  if (cookie) {
    result.set("cookie", cookie);
  }
  if (clientAddress) {
    result.set("cf-connecting-ip", clientAddress);
  }
  return result;
}

function isClubSummary(value: unknown): value is ClubSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const club = value as Record<string, unknown>;
  return (
    typeof club.id === "string" &&
    typeof club.name === "string" &&
    (club.description === undefined || typeof club.description === "string") &&
    typeof club.hasAvatar === "boolean" &&
    (club.avatarVersion === undefined || typeof club.avatarVersion === "string") &&
    (club.lifecycle === "ACTIVE" || club.lifecycle === "ARCHIVED") &&
    ["ADMIN", "MODERATOR", "MEMBER"].includes(String(club.membershipRole)) &&
    (club.selectionScaleMin === 0 || club.selectionScaleMin === 1) &&
    Number.isInteger(club.selectionScaleMax) &&
    (club.tier === "FREE" || club.tier === "PRO")
  );
}

function isReceipt(value: unknown): value is ClubOperationReceipt {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).changed === "boolean" &&
    typeof (value as Record<string, unknown>).replayed === "boolean",
  );
}

function isClubSettings(value: unknown): value is ClubSettingsProjection {
  if (!value || typeof value !== "object") {
    return false;
  }
  const settings = value as Record<string, unknown>;
  const permissions = settings.permissions as Record<string, unknown> | undefined;
  const entitlements = settings.entitlements as Record<string, unknown> | undefined;
  const visibility = settings.visibility as Record<string, unknown> | undefined;
  const booleanValues = (record: Record<string, unknown> | undefined) =>
    Boolean(record && Object.values(record).every((entry) => typeof entry === "boolean"));
  return (
    isClubSummary(settings.club) &&
    booleanValues(permissions) &&
    Boolean(entitlements && (entitlements.tier === "FREE" || entitlements.tier === "PRO")) &&
    booleanValues(visibility) &&
    Array.isArray(settings.members) &&
    settings.members.every((member) => {
      if (!member || typeof member !== "object") {
        return false;
      }
      const item = member as Record<string, unknown>;
      return typeof item.id === "string" && typeof item.displayName === "string" &&
        ["ADMIN", "MODERATOR", "MEMBER"].includes(String(item.role)) && typeof item.joinedAt === "string";
    }) &&
    Array.isArray(settings.auditEvents) &&
    settings.auditEvents.every((event) => {
      if (!event || typeof event !== "object") {
        return false;
      }
      const item = event as Record<string, unknown>;
      return typeof item.id === "string" && typeof item.action === "string" &&
        typeof item.changed === "boolean" && typeof item.createdAt === "string";
    })
  );
}

async function parseResponse<T>(response: Response, validate: (value: unknown) => value is T): Promise<ClubApiResult<T>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = undefined;
  }
  const body = response.ok && validate(value) ? value : undefined;
  const error = value && typeof value === "object" && "error" in value
    ? (value as ApiErrorEnvelope).error
    : undefined;
  return {
    ok: body !== undefined,
    status: response.status,
    ...(body !== undefined ? { body } : {}),
    ...(error ? { code: error.code } : {}),
    ...(typeof error?.reason === "string" ? { reason: error.reason } : {}),
  };
}

export async function loadClubCollection(
  requestHeaders: RequestHeaders,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubCollectionResponse>> {
  const response = await fetcher(backendEndpoint("/clubs"), {
    cache: "no-store",
    headers: forwardingHeaders(requestHeaders),
    signal: AbortSignal.timeout(5_000),
  });
  return parseResponse(response, (value): value is ClubCollectionResponse => {
    if (!value || typeof value !== "object" || !("clubs" in value)) {
      return false;
    }
    return Array.isArray(value.clubs) && value.clubs.every(isClubSummary);
  });
}

export async function submitClubCreation(
  requestHeaders: RequestHeaders,
  payload: CreateClubRequest,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<CreateClubResponse>> {
  const forwarded = forwardingHeaders(requestHeaders);
  forwarded.set("content-type", "application/json");
  const response = await fetcher(backendEndpoint("/clubs"), {
    method: "POST",
    cache: "no-store",
    headers: forwarded,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  return parseResponse(response, (value): value is CreateClubResponse =>
    Boolean(value && typeof value === "object" && "club" in value && isClubSummary(value.club))
  );
}

export async function loadClubSettings(
  requestHeaders: RequestHeaders,
  clubId: string,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubSettingsProjection>> {
  const response = await fetcher(backendEndpoint(`/clubs/${clubId}/settings`), {
    cache: "no-store",
    headers: forwardingHeaders(requestHeaders),
    signal: AbortSignal.timeout(5_000),
  });
  return parseResponse(response, isClubSettings);
}

async function submitJson<T>(
  requestHeaders: RequestHeaders,
  path: string,
  method: "DELETE" | "PATCH" | "POST",
  payload: unknown,
  validate: (value: unknown) => value is T,
  fetcher: Fetcher,
): Promise<ClubApiResult<T>> {
  const forwarded = forwardingHeaders(requestHeaders);
  forwarded.set("content-type", "application/json");
  const response = await fetcher(backendEndpoint(path), {
    method,
    cache: "no-store",
    headers: forwarded,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  return parseResponse(response, validate);
}

export async function submitClubSettings(
  requestHeaders: RequestHeaders,
  clubId: string,
  payload: UpdateClubSettingsRequest,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<UpdateClubSettingsResponse>> {
  return submitJson(
    requestHeaders,
    `/clubs/${clubId}/settings`,
    "PATCH",
    payload,
    (value): value is UpdateClubSettingsResponse =>
      Boolean(isReceipt(value) && value && typeof value === "object" && "settings" in value && isClubSettings(value.settings)),
    fetcher,
  );
}

export async function submitClubOperation(
  requestHeaders: RequestHeaders,
  clubId: string,
  request: ClubLifecycleRequest,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubOperationReceipt>> {
  const { action, ...payload } = request;
  return submitJson(requestHeaders, `/clubs/${clubId}/${action}`, "POST", payload, isReceipt, fetcher);
}

export async function submitClubMemberRole(
  requestHeaders: RequestHeaders,
  clubId: string,
  membershipId: string,
  payload: ChangeClubMemberRoleRequest,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubOperationReceipt>> {
  return submitJson(
    requestHeaders,
    `/clubs/${clubId}/members/${membershipId}/role`,
    "PATCH",
    payload,
    isReceipt,
    fetcher,
  );
}

export async function removeClubAvatar(
  requestHeaders: RequestHeaders,
  clubId: string,
  payload: ClubOperationRequest,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubAvatarResponse>> {
  return submitJson(
    requestHeaders,
    `/clubs/${clubId}/avatar`,
    "DELETE",
    payload,
    (value): value is ClubAvatarResponse =>
      Boolean(isReceipt(value) && typeof (value as ClubAvatarResponse).hasAvatar === "boolean"),
    fetcher,
  );
}

export async function uploadClubAvatar(
  requestHeaders: RequestHeaders,
  clubId: string,
  operationId: string,
  file: File,
  fetcher: Fetcher = fetch,
): Promise<ClubApiResult<ClubAvatarResponse>> {
  const forwarded = forwardingHeaders(requestHeaders);
  forwarded.set("content-type", file.type);
  forwarded.set("x-operation-id", operationId);
  const response = await fetcher(backendEndpoint(`/clubs/${clubId}/avatar`), {
    method: "PUT",
    cache: "no-store",
    headers: forwarded,
    body: await file.arrayBuffer(),
    signal: AbortSignal.timeout(10_000),
  });
  return parseResponse(response, (value): value is ClubAvatarResponse =>
    Boolean(isReceipt(value) && typeof (value as ClubAvatarResponse).hasAvatar === "boolean")
  );
}
