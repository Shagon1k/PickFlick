import type {
  ApiErrorEnvelope,
  ClubCollectionResponse,
  ClubSummary,
  CreateClubRequest,
  CreateClubResponse,
} from "@pickflick/contracts";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type RequestHeaders = Pick<Headers, "get">;

export interface ClubApiResult<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly body?: T;
  readonly code?: string;
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
    (club.lifecycle === "ACTIVE" || club.lifecycle === "ARCHIVED") &&
    ["ADMIN", "MODERATOR", "MEMBER"].includes(String(club.membershipRole)) &&
    (club.selectionScaleMin === 0 || club.selectionScaleMin === 1) &&
    Number.isInteger(club.selectionScaleMax) &&
    (club.tier === "FREE" || club.tier === "PRO")
  );
}

async function parseResponse<T>(response: Response, validate: (value: unknown) => value is T): Promise<ClubApiResult<T>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = undefined;
  }
  const error = value as ApiErrorEnvelope | undefined;
  return {
    ok: response.ok && validate(value),
    status: response.status,
    ...(response.ok && validate(value) ? { body: value } : {}),
    ...(error && typeof error === "object" && "error" in error ? { code: error.error.code } : {}),
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
