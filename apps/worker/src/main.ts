import { loadWorkerEnvironment } from "@pickflick/config/environment";
import { createDatabaseClient } from "@pickflick/database";
import { checkReadiness, createLogger, createRuntimeDependencyProbes } from "@pickflick/observability";

import { runWorker } from "./worker.js";

const controller = new AbortController();
const stop = () => controller.abort();

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function bootstrap(): Promise<void> {
  const environment = loadWorkerEnvironment();
  const logger = createLogger({ service: "worker", environment: environment.appEnvironment });
  const database = createDatabaseClient(environment.databaseUrl);
  const probes = createRuntimeDependencyProbes(environment, async () => {
    await database.$queryRaw`SELECT 1`;
  });

  try {
    await runWorker(controller.signal, {
      logger,
      readiness: () => checkReadiness(probes),
    });
  } catch {
    if (!controller.signal.aborted) {
      logger.fatal({ event: "service.start.failed" }, "Worker failed to start.");
      process.exitCode = 1;
    }
  } finally {
    await database.$disconnect();
  }
}

try {
  await bootstrap();
} catch {
  process.stderr.write(
    `${JSON.stringify({
      level: "fatal",
      service: "worker",
      event: "configuration.invalid",
      message: "Worker configuration is invalid.",
      time: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
}
