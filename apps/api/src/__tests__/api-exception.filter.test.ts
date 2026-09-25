import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Writable } from "node:stream";

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Module,
  Post,
  type ArgumentsHost,
  type INestApplication,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { ApiErrorEnvelope } from "@pickflick/contracts";
import { createLogger, runWithRequestCorrelation } from "@pickflick/observability";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiExceptionFilter } from "../api-exception.filter.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

@Controller("body")
class BodyController {
  @Post()
  accept(@Body() body: unknown): unknown {
    return body;
  }
}

@Module({ controllers: [BodyController] })
class TestModule {}

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

  it("passes through only a stable conflict reason code", () => {
    const logger = createLogger({ service: "api", environment: "test", destination: captureLogs().destination });
    const coded = responseHost();
    new ApiExceptionFilter(logger).catch(new ConflictException({ reason: "SESSION_HISTORY" }), coded.host);
    expect(coded.body()?.error).toMatchObject({ code: "CONFLICT", reason: "SESSION_HISTORY" });

    const freeForm = responseHost();
    new ApiExceptionFilter(logger).catch(new ConflictException({ reason: "leaked detail" }), freeForm.host);
    expect(freeForm.body()?.error).not.toHaveProperty("reason");
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

describe("ApiExceptionFilter HTTP boundary", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const logs = captureLogs();
    const logger = createLogger({ service: "api", environment: "test", destination: logs.destination });
    app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalFilters(new ApiExceptionFilter(logger));
    await app.listen(0, "127.0.0.1");

    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("preserves malformed JSON as a validation failure", async () => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"title":',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        message: "Request validation failed.",
      },
    });
  });

  it("preserves oversized JSON as a payload-too-large failure", async () => {
    const response = await fetch(`${baseUrl}/body`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(110_000) }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload is too large.",
      },
    });
  });
});
