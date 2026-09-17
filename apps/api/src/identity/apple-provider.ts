import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { createDatabaseClient } from "@pickflick/database";
import { createAuthorizationURL, verifyProviderIdToken } from "better-auth/oauth2";
import { apple } from "better-auth/social-providers";

import { createAppleClientSecret } from "./apple-client-secret.js";

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
  const options = {
    clientId: environment.auth.appleClientId,
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
        clientSecret: createAppleClientSecret(environment.auth),
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
      if (!result || (result.user.email && result.user.emailVerified)) {
        return result;
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
        return result;
      }

      return {
        ...result,
        user: {
          ...result.user,
          email: existingAccount.providerEmail ?? existingAccount.user.email,
          emailVerified: true,
        },
      };
    },
  };

  return provider;
}
