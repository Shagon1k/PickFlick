import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { createDatabaseClient } from "@pickflick/database";
import { createAuthorizationURL, verifyProviderIdToken } from "better-auth/oauth2";
import { apple } from "better-auth/social-providers";

import { createAppleClientSecret } from "./apple-client-secret.js";
import { normalizeAppleDisplayName } from "./apple-profile.js";

const appleAuthorizationEndpoint = "https://appleid.apple.com/auth/authorize";

/**
 * Adds OIDC nonce verification and generates a short-lived Apple client secret
 * for each token exchange. Known subjects may reuse their stored PickFlick
 * email when Apple omits or no longer verifies an email claim.
 */
export function createAppleOidcProvider(
  environment: RuntimeEnvironment,
  database: ReturnType<typeof createDatabaseClient>,
) {
  if (!environment.auth.appleSignInEnabled) {
    throw new Error("Apple Sign In is disabled.");
  }
  const appleAuth = environment.auth;
  const options = {
    clientId: appleAuth.appleClientId,
    // Authorization only checks that this value exists. Token exchange is
    // overridden below and receives a newly signed secret for every request.
    clientSecret: "generated-per-token-exchange",
  };
  const baseProvider = apple(options);
  const provider = {
    ...baseProvider,
    requiresIdTokenNonce: true,
    async createAuthorizationURL({
      state,
      codeVerifier,
      redirectURI,
      idTokenNonce,
    }: Parameters<typeof baseProvider.createAuthorizationURL>[0]) {
      return createAuthorizationURL({
        id: "apple",
        options,
        authorizationEndpoint: appleAuthorizationEndpoint,
        state,
        codeVerifier,
        redirectURI,
        scopes: ["email", "name"],
        nonce: idTokenNonce,
        responseMode: "form_post",
        responseType: "code id_token",
      });
    },
    async validateAuthorizationCode(input: Parameters<typeof baseProvider.validateAuthorizationCode>[0]) {
      return apple({
        ...options,
        clientSecret: createAppleClientSecret(appleAuth),
      }).validateAuthorizationCode(input);
    },
    async getUserInfo(tokens: Parameters<typeof baseProvider.getUserInfo>[0]) {
      if (
        !tokens.idToken ||
        !tokens.expectedIdTokenNonce ||
        !await verifyProviderIdToken(provider, tokens.idToken, tokens.expectedIdTokenNonce)
      ) {
        return null;
      }

      const result = await baseProvider.getUserInfo(tokens);
      if (!result) {
        return result;
      }

      const sanitizedResult = {
        ...result,
        user: {
          ...result.user,
          name: normalizeAppleDisplayName(result.user.name) ?? "",
        },
      };
      if (result.user.email && result.user.emailVerified) {
        return sanitizedResult;
      }

      const existingAccount = await database.providerAccount.findUnique({
        where: {
          provider_providerSubject: {
            provider: "apple",
            providerSubject: result.data.sub,
          },
        },
        select: {
          providerEmail: true,
          user: { select: { email: true } },
        },
      });
      if (!existingAccount) {
        return sanitizedResult;
      }

      return {
        ...sanitizedResult,
        user: {
          ...sanitizedResult.user,
          email: existingAccount.providerEmail ?? existingAccount.user.email,
          emailVerified: true,
        },
      };
    },
  };

  return provider;
}
