import type { NestExpressApplication } from "@nestjs/platform-express";
import { CLUB_AVATAR_MAX_BYTES, CLUB_AVATAR_MEDIA_TYPES } from "@pickflick/contracts";
import type { ApplicationLogger } from "@pickflick/observability";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { IdentityService } from "./identity/identity.service.js";
import { configureProxyTrust } from "./proxy-trust.js";
import { createRequestContextMiddleware } from "./request-context.js";

export function configureApplication(app: NestExpressApplication, logger: ApplicationLogger): void {
  configureProxyTrust(app);
  app.use(createRequestContextMiddleware(logger));
  app.useBodyParser("json", { limit: "100kb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "100kb" });
  app.useBodyParser("raw", {
    // Leaves headroom above the avatar limit so the service, not the parser, rejects oversize images.
    limit: CLUB_AVATAR_MAX_BYTES + 88 * 1024,
    type: [...CLUB_AVATAR_MEDIA_TYPES],
  });
  app.useBodyParser("raw", { limit: "100kb", type: () => true });
  app.getHttpAdapter().getInstance().all("/api/auth/*splat", app.get(IdentityService).handler);
  app.useGlobalFilters(new ApiExceptionFilter(logger));
}
