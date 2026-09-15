import type { ApiErrorEnvelope, ContactSubmissionRequest, ContactSubmissionResponse } from "@pickflick/contracts";

export interface ContactSubmissionResult {
  readonly code?: string;
  readonly ok: boolean;
  readonly status: number;
}

interface SubmitContactOptions {
  readonly endpoint: URL;
  readonly forwardedFor?: string;
  readonly request?: typeof fetch;
}

export async function submitContactRequest(
  payload: ContactSubmissionRequest,
  options: SubmitContactOptions,
): Promise<ContactSubmissionResult> {
  const response = await (options.request ?? fetch)(options.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options.forwardedFor ? { "x-forwarded-for": options.forwardedFor } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  let body: ApiErrorEnvelope | ContactSubmissionResponse | undefined;
  try {
    body = await response.json() as ApiErrorEnvelope | ContactSubmissionResponse;
  } catch {
    body = undefined;
  }
  return {
    ok: response.ok && body !== undefined && "status" in body && ["accepted", "duplicate"].includes(body.status),
    status: response.status,
    ...(body && "error" in body ? { code: body.error.code } : {}),
  };
}
