interface ProviderAccountInput {
  readonly accountId?: string | undefined;
  readonly idToken?: string | null | undefined;
  readonly providerId?: string | undefined;
}

interface AppleIdTokenClaims {
  readonly email?: unknown;
  readonly email_verified?: unknown;
  readonly sub?: unknown;
}

interface AppleFirstReturn {
  readonly name?: {
    readonly firstName?: unknown;
    readonly lastName?: unknown;
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function parseIdTokenClaims(idToken: string): AppleIdTokenClaims | undefined {
  try {
    const encodedPayload = idToken.split(".")[1];
    if (!encodedPayload) {
      return undefined;
    }
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AppleIdTokenClaims;
  } catch {
    return undefined;
  }
}

function normalizedName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const result = value.trim().replace(/\s+/g, " ");
  return result ? result.slice(0, 200) : undefined;
}

export function appleProviderAccountProfile(
  account: ProviderAccountInput,
  callbackUser: unknown,
): { providerDisplayName?: string; providerEmail?: string } {
  if (account.providerId !== "apple" || !account.idToken) {
    return {};
  }

  // The account hook runs only after the Apple adapter verifies the ID token
  // signature and nonce. Recheck its identity-bearing claims before copying
  // profile metadata into the provider-owned row.
  const claims = parseIdTokenClaims(account.idToken);
  if (!claims || claims.sub !== account.accountId) {
    return {};
  }

  const profile: { providerDisplayName?: string; providerEmail?: string } = {};
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (emailVerified && typeof claims.email === "string") {
    const email = claims.email.trim().toLowerCase();
    if (email && email.length <= 320) {
      profile.providerEmail = email;
    }
  }

  const firstReturn = parseJson(callbackUser) as AppleFirstReturn | undefined;
  const firstName = normalizedName(firstReturn?.name?.firstName);
  const lastName = normalizedName(firstReturn?.name?.lastName);
  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  if (displayName) {
    profile.providerDisplayName = displayName.slice(0, 200);
  }

  return profile;
}
