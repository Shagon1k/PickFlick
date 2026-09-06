import { Writable } from "node:stream";

import { createLogger } from "@pickflick/observability";
import { describe, expect, it } from "vitest";

import { executeCorrelatedJob, runWorker, WorkerNotReadyError, workerStatus } from "./worker.js";

function captureLogger() {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return {
    logger: createLogger({ service: "worker", environment: "test", destination }),
    output: () => output,
  };
}

describe("worker scaffold", () => {
  it("starts and stops through an abort signal", async () => {
    const logs = captureLogger();
    const controller = new AbortController();
    const running = runWorker(controller.signal, {
      logger: logs.logger,
      readiness: async () => ({ status: "ready", checks: [] }),
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(running).resolves.toBeUndefined();
    expect(workerStatus).toEqual({ service: "worker", status: "scaffold" });
    expect(logs.output()).toContain('"event":"service.ready"');
    expect(logs.output()).toContain('"event":"service.stopped"');
  });

  it("refuses readiness when a required dependency is unavailable", async () => {
    const logs = captureLogger();
    const controller = new AbortController();

    await expect(
      runWorker(controller.signal, {
        logger: logs.logger,
        readiness: async () => ({
          status: "not_ready",
          checks: [{ name: "redis", status: "down" }],
        }),
      }),
    ).rejects.toThrow(WorkerNotReadyError);
    expect(logs.output()).toContain('"unavailableDependencies":["redis"]');
  });

  it("correlates job lifecycle logs without logging handler failures", async () => {
    const logs = captureLogger();

    await expect(
      executeCorrelatedJob(
        { id: "job-42", correlationId: "123e4567-e89b-42d3-a456-426614174000" },
        logs.logger,
        async () => {
          throw new Error("private payload");
        },
      ),
    ).rejects.toThrow("private payload");

    expect(logs.output()).toContain('"jobId":"job-42"');
    expect(logs.output()).toContain('"correlationId":"123e4567-e89b-42d3-a456-426614174000"');
    expect(logs.output()).not.toContain("private payload");
  });
});
