import { Writable } from "node:stream";

import { BadRequestException, type ArgumentsHost } from "@nestjs/common";
import type { ApiErrorEnvelope } from "@pickflick/contracts";
import { createLogger, runWithRequestCorrelation } from "@pickflick/observability";
import { describe, expect, it, vi } from "vitest";

import { ApiExceptionFilter } from "./api-exception.filter.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

function captureLogs() {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { destination, output: () => output };
}

function responseHost() {
  let body: ApiErrorEnvelope | undefined;
  const response = {
    getHeader: vi.fn(() => requestId),
    status: vi.fn(() => response),
    json: vi.fn((value: ApiErrorEnvelope) => {
      body = value;
    }),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  return { host, response, body: () => body };
}

describe("ApiExceptionFilter", () => {
  it("maps boundary failures to a stable safe envelope", () => {
    const logs = captureLogs();
    const logger = createLogger({ service: "api", environment: "test", destination: logs.destination });
    const target = responseHost();

    runWithRequestCorrelation(requestId, () => {
      new ApiExceptionFilter(logger).catch(new BadRequestException("unsafe provider detail"), target.host);
    });

    expect(target.response.status).toHaveBeenCalledWith(400);
    expect(target.body()).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed.",
        requestId,
      },
    });
    expect(logs.output()).not.toContain("unsafe provider detail");
    expect(logs.output()).toContain(requestId);
  });

  it("does not expose unexpected error details", () => {
    const logs = captureLogs();
    const logger = createLogger({ service: "api", environment: "test", destination: logs.destination });
    const target = responseHost();

    new ApiExceptionFilter(logger).catch(new Error("database password exposed"), target.host);

    expect(target.response.status).toHaveBeenCalledWith(500);
    expect(target.body()?.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
    expect(logs.output()).not.toContain("database password exposed");
  });
});
