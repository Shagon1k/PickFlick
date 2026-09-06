import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Writable } from "node:stream";

import { createLogger } from "@pickflick/observability";
import { describe, expect, it, vi } from "vitest";

import { createRequestContextMiddleware } from "./request-context.js";

describe("request context middleware", () => {
  it("logs a route template and replaces unsafe request identifiers", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ service: "api", environment: "test", destination });
    const request = Object.assign(new EventEmitter(), {
      headers: { "x-request-id": "private marker" },
      method: "GET",
      route: { path: "/clubs/:clubId" },
      url: "/clubs/private-club?email=private@example.invalid",
    }) as unknown as IncomingMessage;
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: vi.fn(),
    }) as unknown as ServerResponse;
    const next = vi.fn();

    createRequestContextMiddleware(logger)(request, response, next);
    response.emit("finish");

    expect(next).toHaveBeenCalledOnce();
    expect(response.setHeader).toHaveBeenCalledWith("x-request-id", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(output).toContain('"route":"/clubs/:clubId"');
    expect(output).not.toContain("private marker");
    expect(output).not.toContain("private-club");
    expect(output).not.toContain("private@example.invalid");
  });
});
