import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { loadRuntimeEnvironment } from "@pickflick/config/environment";
import { createLogger } from "@pickflick/observability";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { AppModule } from "./app.module.js";
import { createRequestContextMiddleware } from "./request-context.js";

async function bootstrap(): Promise<void> {
  const environment = loadRuntimeEnvironment();
  const logger = createLogger({ service: "api", environment: environment.appEnvironment });

  try {
    const app = await NestFactory.create(AppModule.register(environment), { logger: false });
    app.use(createRequestContextMiddleware(logger));
    app.useGlobalFilters(new ApiExceptionFilter(logger));
    app.enableShutdownHooks();
    await app.listen(environment.apiPort, environment.apiHost);
    logger.info(
      { event: "service.started", host: environment.apiHost, port: environment.apiPort },
      "API listening.",
    );
  } catch {
    logger.fatal({ event: "service.start.failed" }, "API failed to start.");
    process.exitCode = 1;
  }
}

try {
  await bootstrap();
} catch {
  process.stderr.write(
    `${JSON.stringify({
      level: "fatal",
      service: "api",
      event: "configuration.invalid",
      message: "API configuration is invalid.",
      time: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
}
