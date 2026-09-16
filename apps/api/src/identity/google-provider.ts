import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthorizationURL, verifyProviderIdToken } from "better-auth/oauth2";
import { google } from "better-auth/social-providers";

/**
 * Wraps Better Auth's Google adapter so redirect sign-in binds the verified
 * ID token to the browser's one-time OAuth attempt with an OIDC nonce.
 */
export function googleOidcProvider(environment: RuntimeEnvironment): BetterAuthPlugin {
  const options = {
    accessType: "online" as const,
    clientId: environment.auth.googleClientId,
    clientSecret: environment.auth.googleClientSecret,
    includeGrantedScopes: false,
    scopes: ["openid", "email", "profile"],
  };
  const baseProvider = google(options);
  const provider = {
    ...baseProvider,
    requiresIdTokenNonce: true,
    async createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI,
      loginHint,
      display,
      idTokenNonce,
      additionalParams,
    }: Parameters<typeof baseProvider.createAuthorizationURL>[0]) {
      return createAuthorizationURL({
        id: "google",
        options,
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        state,
        codeVerifier,
        redirectURI,
        scopes: scopes ?? options.scopes,
        loginHint,
        display,
        nonce: idTokenNonce,
        accessType: options.accessType,
        additionalParams,
      });
    },
    async getUserInfo(tokens: Parameters<typeof baseProvider.getUserInfo>[0]) {
      if (
        !tokens.idToken ||
        !tokens.expectedIdTokenNonce ||
        !await verifyProviderIdToken(provider, tokens.idToken, tokens.expectedIdTokenNonce)
      ) {
        return null;
      }
      return baseProvider.getUserInfo(tokens);
    },
  };

  return {
    id: "pickflick-google-oidc",
    init: () => ({ context: { socialProviders: [provider] } }),
  };
}
