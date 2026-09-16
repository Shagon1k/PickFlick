import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadRuntimeEnvironment, safeEnvironmentValidationFailures } from "@pickflick/config/environment";
import { completeWithin, createLogger } from "@pickflick/observability";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { AppModule } from "./app.module.js";
import { configureProxyTrust } from "./proxy-trust.js";
import { IdentityService } from "./identity/identity.service.js";
import { createRequestContextMiddleware } from "./request-context.js";

async function bootstrap(): Promise<void> {
  const environment = loadRuntimeEnvironment();
  const logger = createLogger({ service: "api", environment: environment.appEnvironment });

  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(environment, logger), {
      bodyParser: false,
      logger: false,
    });
    configureProxyTrust(app);
    app.use(createRequestContextMiddleware(logger));
    app.getHttpAdapter().getInstance().all("/api/auth/*splat", app.get(IdentityService).handler);
    app.useBodyParser("json", { limit: "100kb" });
    app.useBodyParser("urlencoded", { extended: true, limit: "100kb" });
    app.useGlobalFilters(new ApiExceptionFilter(logger));
    await app.listen(environment.apiPort, environment.apiHost);
    logger.info(
      { event: "service.started", host: environment.apiHost, port: environment.apiPort },
      "API listening.",
    );

    let shutdown: Promise<void> | undefined;
    const stop = (signal: NodeJS.Signals) => {
      shutdown ??= (async () => {
        try {
          logger.info({ event: "service.stopping", signal }, "API stopping.");
          const closed = await completeWithin(app.close(), environment.shutdownTimeoutMilliseconds);
          if (!closed) {
            logger.fatal({ event: "service.shutdown.timeout", signal }, "API shutdown timed out.");
            process.exit(1);
          }
          logger.info({ event: "service.stopped", signal }, "API stopped.");
        } catch {
          logger.fatal({ event: "service.shutdown.failed", signal }, "API shutdown failed.");
          process.exit(1);
        }
      })();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch {
    logger.fatal({ event: "service.start.failed" }, "API failed to start.");
    process.exitCode = 1;
  }
}

try {
  await bootstrap();
} catch (error) {
  const failures = safeEnvironmentValidationFailures(error);
  process.stderr.write(
    `${JSON.stringify({
      level: "fatal",
      service: "api",
      event: "configuration.invalid",
      message: "API configuration is invalid.",
      ...(failures ? { failures } : {}),
      time: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
}
