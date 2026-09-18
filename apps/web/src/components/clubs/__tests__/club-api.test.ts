import { describe, expect, it, vi } from "vitest";

import { loadClubCollection, submitClubCreation } from "../club-api";

const requestHeaders = new Headers({
  cookie: "pickflick.session_token=secret-session-value",
  "cf-connecting-ip": "192.0.2.10",
  authorization: "must-not-forward",
});
const club = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Midnight Society",
  lifecycle: "ACTIVE",
  membershipRole: "ADMIN",
  selectionScaleMin: 0,
  selectionScaleMax: 7,
  tier: "FREE",
} as const;

describe("Club web API boundary", () => {
  it("loads only a structurally valid private Club collection", async () => {
    const request = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("cookie")).toBe("pickflick.session_token=secret-session-value");
      expect(headers.get("cf-connecting-ip")).toBe("192.0.2.10");
      expect(headers.get("authorization")).toBeNull();
      return new Response(JSON.stringify({ clubs: [club] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(loadClubCollection(requestHeaders, request)).resolves.toMatchObject({
      ok: true,
      body: { clubs: [club] },
    });
  });

  it("fails closed when a successful response has an invalid shape", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ clubs: [{ name: "Incomplete" }] }), { status: 200 }));
    await expect(loadClubCollection(requestHeaders, request)).resolves.toMatchObject({ ok: false, status: 200 });
  });

  it("submits the validated creation payload and retains safe API error codes", async () => {
    const payload = {
      name: "Midnight Society",
      selectionScaleMin: 0 as const,
      selectionScaleMax: 7,
    };
    const createRequest = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      expect(JSON.parse(String(init?.body))).toEqual(payload);
      return new Response(JSON.stringify({ club }), { status: 201 });
    });
    await expect(submitClubCreation(requestHeaders, payload, createRequest)).resolves.toMatchObject({
      ok: true,
      body: { club },
    });

    const conflictRequest = vi.fn(async () => new Response(JSON.stringify({
      error: { code: "CONFLICT", message: "Conflict.", requestId: "request-1" },
    }), { status: 409 }));
    await expect(submitClubCreation(requestHeaders, payload, conflictRequest)).resolves.toMatchObject({
      ok: false,
      status: 409,
      code: "CONFLICT",
    });
  });
});
