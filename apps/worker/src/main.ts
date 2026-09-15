import { loadWorkerEnvironment, safeEnvironmentValidationFailures } from "@pickflick/config/environment";
import { checkDatabaseReadiness, createDatabaseClient } from "@pickflick/database";
import {
  checkReadiness,
  createLogger,
  createRuntimeDependencyProbes,
  DrainController,
} from "@pickflick/observability";

import { runWorker } from "./worker.js";
import {
  PrismaContactDeliveryStore,
  ResendContactSender,
  runContactDeliveryLoop,
} from "./contact-delivery.js";

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
  const database = createDatabaseClient(environment.databaseUrl);
  const probes = createRuntimeDependencyProbes(environment, (timeoutMilliseconds) =>
    checkDatabaseReadiness(environment.databaseUrl, timeoutMilliseconds),
  );

  try {
    const store = new PrismaContactDeliveryStore(database, logger);
    const sender = new ResendContactSender(environment);
    await runWorker(controller.signal, {
      logger,
      readiness: () => checkReadiness(probes),
      drain,
      shutdownTimeoutMilliseconds: environment.shutdownTimeoutMilliseconds,
      ...(!environment.resend.deliveryEnabled
        ? {}
        : { work: (signal: AbortSignal) => runContactDeliveryLoop(signal, store, sender, logger, drain) }),
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
  } finally {
    await database.$disconnect();
  }
}

try {
  await bootstrap();
} catch (error) {
  const failures = safeEnvironmentValidationFailures(error);
  process.stderr.write(
    `${JSON.stringify({
      level: "fatal",
      service: "worker",
      event: "configuration.invalid",
      message: "Worker configuration is invalid.",
      ...(failures ? { failures } : {}),
      time: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
}
