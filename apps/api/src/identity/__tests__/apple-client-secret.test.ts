import { generateKeyPairSync, verify } from "node:crypto";

import type { RuntimeEnvironment } from "@pickflick/config/environment";
import { describe, expect, it } from "vitest";

import { createAppleClientSecret } from "../apple-client-secret.js";

function decodeSection(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("Apple client secret", () => {
  it("creates a five-minute ES256 client assertion without retaining a generated secret", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const auth = {
      appleClientId: "app.pickflick.test",
      appleKeyId: "TESTKEY01",
      applePrivateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      appleTeamId: "TESTTEAM01",
    } as RuntimeEnvironment["auth"];
    const now = new Date("2026-09-17T10:00:00.000Z");
    const assertion = createAppleClientSecret(auth, now);
    const [encodedHeader, encodedPayload, encodedSignature] = assertion.split(".") as [string, string, string];

    expect(decodeSection(encodedHeader)).toEqual({ alg: "ES256", kid: "TESTKEY01", typ: "JWT" });
    expect(decodeSection(encodedPayload)).toEqual({
      aud: "https://appleid.apple.com",
      exp: 1_789_639_500,
      iat: 1_789_639_200,
      iss: "TESTTEAM01",
      sub: "app.pickflick.test",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        { dsaEncoding: "ieee-p1363", key: publicKey },
        Buffer.from(encodedSignature, "base64url"),
      ),
    ).toBe(true);
  });
});
