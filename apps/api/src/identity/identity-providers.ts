import type { RuntimeEnvironment } from "@pickflick/config/environment";
import type { createDatabaseClient } from "@pickflick/database";
import type { BetterAuthPlugin } from "better-auth";

import { createAppleOidcProvider } from "./apple-provider.js";
import { createGoogleOidcProvider } from "./google-provider.js";

export function identityProviders(
  environment: RuntimeEnvironment,
  database: ReturnType<typeof createDatabaseClient>,
): BetterAuthPlugin {
  return {
    id: "pickflick-oidc-providers",
    init: () => ({
      context: {
        socialProviders: [
          createGoogleOidcProvider(environment),
          createAppleOidcProvider(environment, database),
        ],
      },
    }),
  };
}
