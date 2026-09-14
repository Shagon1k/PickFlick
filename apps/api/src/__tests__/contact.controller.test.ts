import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Writable } from "node:stream";

import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createLogger } from "@pickflick/observability";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ApiExceptionFilter } from "../api-exception.filter.js";
import { ContactController } from "../contact/contact.controller.js";
import {
  ContactConflictError,
  ContactRateLimitError,
  ContactService,
  ContactValidationError,
} from "../contact/contact.service.js";
import { createRequestContextMiddleware } from "../request-context.js";

const privateBodyMarker = "private-contact-body-marker";

class StubContactService {
  async submit(body: unknown) {
    const state = (body as { state?: string }).state;
    if (state === "invalid") {
      throw new ContactValidationError();
    }
    if (state === "conflict") {
      throw new ContactConflictError();
    }
    if (state === "rate") {
      throw new ContactRateLimitError();
    }
    if (state === "failure") {
      throw new Error(privateBodyMarker);
    }
    return { id: "123e4567-e89b-42d3-a456-426614174000", status: "accepted" as const };
  }
}

@Module({
  controllers: [ContactController],
  providers: [{ provide: ContactService, useClass: StubContactService }],
})
class TestModule {}

describe("ContactController HTTP boundary", () => {
  let app: INestApplication;
  let baseUrl: string;
  let output = "";

  beforeAll(async () => {
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ service: "api", environment: "test", destination });
    app = await NestFactory.create(TestModule, { logger: false });
    app.use(createRequestContextMiddleware(logger));
    app.useGlobalFilters(new ApiExceptionFilter(logger));
    await app.listen(0, "127.0.0.1");
    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => app.close());

  async function submit(state: string) {
    return fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state, message: privateBodyMarker }),
    });
  }

  it("returns an accepted result without echoing submitted content", async () => {
    const response = await submit("valid");
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      id: "123e4567-e89b-42d3-a456-426614174000",
      status: "accepted",
    });
  });

  it.each([
    ["invalid", 400, "VALIDATION_FAILED"],
    ["conflict", 409, "CONFLICT"],
    ["failure", 500, "INTERNAL_ERROR"],
  ])("maps %s without exposing request content", async (state, status, code) => {
    const response = await submit(state);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it("returns a stable rate-limit response and retry window", async () => {
    const response = await submit("rate");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "RATE_LIMITED" } });
  });

  it("never writes a Contact body to request or failure logs", () => {
    expect(output).not.toContain(privateBodyMarker);
  });
});
