import { createPrivateKey, sign } from "node:crypto";

import type { RuntimeEnvironment } from "@pickflick/config/environment";

const appleAudience = "https://appleid.apple.com";
const clientSecretLifetimeSeconds = 5 * 60;

function encodeJson(value: Readonly<Record<string, string | number>>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createAppleClientSecret(
  auth: RuntimeEnvironment["auth"],
  now: Date = new Date(),
): string {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const header = encodeJson({ alg: "ES256", kid: auth.appleKeyId, typ: "JWT" });
  const payload = encodeJson({
    aud: appleAudience,
    exp: issuedAt + clientSecretLifetimeSeconds,
    iat: issuedAt,
    iss: auth.appleTeamId,
    sub: auth.appleClientId,
  });
  const signingInput = `${header}.${payload}`;
  const privateKey = createPrivateKey(auth.applePrivateKey.replaceAll("\\n", "\n"));
  const signature = sign("sha256", Buffer.from(signingInput), {
    dsaEncoding: "ieee-p1363",
    key: privateKey,
  });

  return `${signingInput}.${signature.toString("base64url")}`;
}
