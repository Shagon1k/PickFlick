import { describe, expect, it, vi } from "vitest";

import { checkStorage } from "./readiness.js";

const storageEnvironment = {
  endpoint: "http://127.0.0.1:9000",
  region: "us-east-1",
  bucket: "pickflick-local",
  accessKeyId: "local-access-key",
  secretAccessKey: "local-secret-key",
  forcePathStyle: true,
} as const;

describe("object storage readiness", () => {
  it("authenticates a HeadBucket request with the configured S3 identity", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));

    await checkStorage(storageEnvironment, {
      fetch: request,
      now: new Date("2026-09-06T12:34:56.000Z"),
    });

    const [target, init] = request.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(String(target)).toBe("http://127.0.0.1:9000/pickflick-local");
    expect(init?.method).toBe("HEAD");
    expect(headers.get("authorization")).toContain(
      "Credential=local-access-key/20260906/us-east-1/s3/aws4_request",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports bucket or credential rejection without credential details", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));

    await expect(checkStorage(storageEnvironment, { fetch: request })).rejects.toThrow(
      "Object storage readiness check failed with HTTP 403.",
    );
  });

  it("reports a bounded storage timeout", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_target, init) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    );

    await expect(
      checkStorage(storageEnvironment, { fetch: request, timeoutMilliseconds: 1 }),
    ).rejects.toThrow("Object storage readiness check timed out.");
  });
});
