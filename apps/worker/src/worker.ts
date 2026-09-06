import { SERVICE_NAMES, type ReadinessReport, type ServiceStatus } from "@pickflick/contracts";
import { runWithJobCorrelation, type ApplicationLogger } from "@pickflick/observability";

export const workerStatus: ServiceStatus = {
  service: SERVICE_NAMES.worker,
  status: "scaffold",
};

export interface WorkerRuntime {
  readonly logger: ApplicationLogger;
  readonly readiness: () => Promise<ReadinessReport>;
}

export interface CorrelatedJob {
  readonly id: string;
  readonly correlationId?: string;
}

export class WorkerNotReadyError extends Error {
  constructor() {
    super("Worker dependencies are unavailable.");
    this.name = "WorkerNotReadyError";
  }
}

export async function executeCorrelatedJob<T>(
  job: CorrelatedJob,
  logger: ApplicationLogger,
  handler: () => Promise<T>,
): Promise<T> {
  return runWithJobCorrelation(job.id, job.correlationId, async () => {
    logger.info({ event: "job.started" }, "Worker job started.");
    try {
      const result = await handler();
      logger.info({ event: "job.completed" }, "Worker job completed.");
      return result;
    } catch (error) {
      logger.error({ event: "job.failed" }, "Worker job failed.");
      throw error;
    }
  });
}

export async function runWorker(signal: AbortSignal, runtime: WorkerRuntime): Promise<void> {
  if (signal.aborted) {
    return;
  }

  const readiness = await runtime.readiness();
  if (signal.aborted) {
    return;
  }
  if (readiness.status === "not_ready") {
    runtime.logger.error(
      {
        event: "service.not_ready",
        unavailableDependencies: readiness.checks
          .filter(({ status }) => status === "down")
          .map(({ name }) => name),
      },
      "Worker dependencies are unavailable.",
    );
    throw new WorkerNotReadyError();
  }

  runtime.logger.info({ event: "service.ready" }, "Worker ready.");

  await new Promise<void>((resolve) => {
    const keepAlive = setInterval(() => undefined, 60_000);
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(keepAlive);
        runtime.logger.info({ event: "service.stopped" }, "Worker stopped.");
        resolve();
      },
      { once: true },
    );
  });
}
