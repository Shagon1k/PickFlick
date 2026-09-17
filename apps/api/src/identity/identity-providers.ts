import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { createDatabaseClient } from "@pickflick/database";
import type { BetterAuthPlugin } from "better-auth";

import { createAppleOidcProvider } from "./apple-provider.js";
import { createGoogleOidcProvider } from "./google-provider.js";

export function identityProviders(
  environment: RuntimeEnvironment,
  database: ReturnType<typeof createDatabaseClient>,
): BetterAuthPlugin {
  const socialProviders: Array<
    ReturnType<typeof createGoogleOidcProvider> | ReturnType<typeof createAppleOidcProvider>
  > = [createGoogleOidcProvider(environment)];
  if (environment.auth.appleSignInEnabled) {
    socialProviders.push(createAppleOidcProvider(environment, database));
  }

  return {
    id: "pickflick-oidc-providers",
    init: () => ({
      context: {
        socialProviders,
      },
    }),
  };
}
