import { loadWorkerEnvironment } from "@pickflick/config/environment";
import { checkDatabaseReadiness } from "@pickflick/database";
import {
  checkReadiness,
  createLogger,
  createRuntimeDependencyProbes,
  DrainController,
} from "@pickflick/observability";

import { runWorker } from "./worker.js";

const controller = new AbortController();
const drain = new DrainController();
const stop = () => {
  drain.stopAccepting();
  controller.abort();
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function bootstrap(): Promise<void> {
  const environment = loadWorkerEnvironment();
  const logger = createLogger({ service: "worker", environment: environment.appEnvironment });
  const probes = createRuntimeDependencyProbes(environment, (timeoutMilliseconds) =>
    checkDatabaseReadiness(environment.databaseUrl, timeoutMilliseconds),
  );

  try {
    await runWorker(controller.signal, {
      logger,
      readiness: () => checkReadiness(probes),
      drain,
      shutdownTimeoutMilliseconds: environment.shutdownTimeoutMilliseconds,
    });
  } catch {
    const shutdownFailed = controller.signal.aborted;
    logger.fatal(
      { event: shutdownFailed ? "service.shutdown.failed" : "service.start.failed" },
      "Worker failed.",
    );
    if (shutdownFailed) {
      process.exit(1);
    }
    process.exitCode = 1;
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
