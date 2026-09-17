import { describe, expect, it } from "vitest";

import { appleProviderAccountProfile } from "../apple-profile.js";

function unsignedIdToken(payload: Readonly<Record<string, unknown>>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("Apple provider profile persistence", () => {
  it("captures a verified relay email and sanitized first-return name", () => {
    expect(
      appleProviderAccountProfile(
        {
          accountId: "apple-subject",
          idToken: unsignedIdToken({
            email: "Relay@PrivateRelay.AppleID.com",
            email_verified: "true",
            sub: "apple-subject",
          }),
          providerId: "apple",
        },
        JSON.stringify({ name: { firstName: "  Alex ", lastName: " Example  User " } }),
      ),
    ).toEqual({
      providerDisplayName: "Alex Example User",
      providerEmail: "relay@privaterelay.appleid.com",
    });
  });

  it("does not trust an unverified email, mismatched subject, or later missing name", () => {
    expect(
      appleProviderAccountProfile(
        {
          accountId: "apple-subject",
          idToken: unsignedIdToken({
            email: "person@example.invalid",
            email_verified: false,
            sub: "apple-subject",
          }),
          providerId: "apple",
        },
        undefined,
      ),
    ).toEqual({});
    expect(
      appleProviderAccountProfile(
        {
          accountId: "different-subject",
          idToken: unsignedIdToken({
            email: "person@example.invalid",
            email_verified: true,
            sub: "apple-subject",
          }),
          providerId: "apple",
        },
        JSON.stringify({ name: { firstName: "Attacker" } }),
      ),
    ).toEqual({});
  });
});
