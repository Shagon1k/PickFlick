import { SERVICE_NAMES, type ReadinessReport, type ServiceStatus } from "@pickflick/contracts";
import { DrainController, runWithJobCorrelation, type ApplicationLogger } from "@pickflick/observability";

export const workerStatus: ServiceStatus = {
  service: SERVICE_NAMES.worker,
  status: "scaffold",
};

export interface WorkerRuntime {
  readonly logger: ApplicationLogger;
  readonly readiness: () => Promise<ReadinessReport>;
  readonly drain: DrainController;
  readonly shutdownTimeoutMilliseconds: number;
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

export class WorkerDrainTimeoutError extends Error {
  constructor() {
    super("Worker did not finish active work before its shutdown deadline.");
    this.name = "WorkerDrainTimeoutError";
  }
}

export async function executeCorrelatedJob<T>(
  job: CorrelatedJob,
  logger: ApplicationLogger,
  drain: DrainController,
  handler: () => Promise<T>,
): Promise<T> {
  return drain.run(() => runWithJobCorrelation(job.id, job.correlationId, async () => {
    logger.info({ event: "job.started" }, "Worker job started.");
    try {
      const result = await handler();
      logger.info({ event: "job.completed" }, "Worker job completed.");
      return result;
    } catch (error) {
      logger.error({ event: "job.failed" }, "Worker job failed.");
      throw error;
    }
  }));
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
        runtime.drain.stopAccepting();
        clearInterval(keepAlive);
        resolve();
      },
      { once: true },
    );
  });

  runtime.logger.info(
    { event: "service.draining", activeWork: runtime.drain.activeWorkCount },
    "Worker draining active work.",
  );
  if (!(await runtime.drain.waitForIdle(runtime.shutdownTimeoutMilliseconds))) {
    runtime.logger.error(
      { event: "service.shutdown.timeout", activeWork: runtime.drain.activeWorkCount },
      "Worker shutdown timed out.",
    );
    throw new WorkerDrainTimeoutError();
  }
  runtime.logger.info({ event: "service.stopped" }, "Worker stopped.");
}
