import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { currentCorrelationContext, resolveCorrelationId, runWithJobCorrelation } from "../correlation.js";
import { createLogger } from "../logging.js";
import { checkReadiness } from "../readiness.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

function captureLogs() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { destination, lines };
}

describe("correlation", () => {
  it("keeps a valid external identifier and replaces unsafe input", () => {
    expect(resolveCorrelationId(requestId)).toBe(requestId);
    expect(resolveCorrelationId("secret value that must not be logged")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("carries job and correlation identifiers through asynchronous work", async () => {
    await runWithJobCorrelation("job-42", requestId, async () => {
      await Promise.resolve();
      expect(currentCorrelationContext()).toEqual({ correlationId: requestId, jobId: "job-42" });
    });
    expect(currentCorrelationContext()).toBeUndefined();
  });

  it("hashes an unsafe job identifier before adding it to context", () => {
    runWithJobCorrelation("private payload@example.invalid", requestId, () => {
      expect(currentCorrelationContext()?.jobId).toMatch(/^job-[0-9a-f]{16}$/);
      expect(currentCorrelationContext()?.jobId).not.toContain("example.invalid");
    });
  });
});

describe("structured logging", () => {
  it("adds correlation context and redacts common secret fields", () => {
    const { destination, lines } = captureLogs();
    const logger = createLogger({ service: "worker", environment: "test", destination });

    runWithJobCorrelation("job-42", requestId, () => {
      logger.info(
        {
          event: "job.started",
          authorization: "Bearer exposed",
          nested: {
            password: "exposed-password",
            databaseUrl: "postgresql://exposed",
            apiKey: "exposed-api-key",
            hashSecret: "exposed-hash-secret",
          },
        },
        "Job started.",
      );
      logger.info({ event: "job.completed" }, "Job completed.");
    });

    const output = lines.join("");
    const records = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const record = records[0];
    expect(record).toMatchObject({
      service: "worker",
      environment: "test",
      event: "job.started",
      correlationId: requestId,
      jobId: "job-42",
      authorization: "[Redacted]",
      nested: {
        password: "[Redacted]",
        databaseUrl: "[Redacted]",
        apiKey: "[Redacted]",
        hashSecret: "[Redacted]",
      },
    });
    expect(output).not.toContain("Bearer exposed");
    expect(output).not.toContain("exposed-password");
    expect(output).not.toContain("postgresql://exposed");
    expect(output).not.toContain("exposed-api-key");
    expect(output).not.toContain("exposed-hash-secret");
    expect(records[1]).not.toHaveProperty("authorization");
    expect(records[1]).not.toHaveProperty("nested");
  });
});

describe("readiness", () => {
  it("reports dependency failures without exposing their errors", async () => {
    const report = await checkReadiness([
      { name: "database", check: async () => undefined },
      {
        name: "redis",
        check: async () => {
          throw new Error("redis://secret-value");
        },
      },
    ]);

    expect(report).toEqual({
      status: "not_ready",
      checks: [
        { name: "database", status: "up" },
        { name: "redis", status: "down" },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("secret-value");
  });

  it("passes the readiness deadline to each dependency probe", async () => {
    let receivedTimeout: number | undefined;
    const report = await checkReadiness(
      [
        {
          name: "database",
          check: async (timeoutMilliseconds) => {
            receivedTimeout = timeoutMilliseconds;
            throw new Error("probe timed out at its driver boundary");
          },
        },
      ],
      17,
    );

    expect(receivedTimeout).toBe(17);
    expect(report).toEqual({
      status: "not_ready",
      checks: [{ name: "database", status: "down" }],
    });
  });
});
