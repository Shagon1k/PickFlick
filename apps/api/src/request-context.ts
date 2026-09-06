import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithRequestCorrelation, type ApplicationLogger } from "@pickflick/observability";

interface RoutedRequest extends IncomingMessage {
  readonly route?: { readonly path?: string };
}

type Next = (error?: unknown) => void;

function incomingRequestId(request: IncomingMessage): string | undefined {
  const header = request.headers["x-request-id"];
  return typeof header === "string" ? header : undefined;
}

export function createRequestContextMiddleware(logger: ApplicationLogger) {
  return (request: RoutedRequest, response: ServerResponse, next: Next): void => {
    const startedAt = process.hrtime.bigint();
    runWithRequestCorrelation(incomingRequestId(request), (requestId) => {
      response.setHeader("x-request-id", requestId);
      response.once("finish", () => {
        const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        logger.info(
          {
            event: "http.request.completed",
            requestId,
            method: request.method,
            route: request.route?.path ?? "unmatched",
            statusCode: response.statusCode,
            durationMilliseconds: Math.round(durationMilliseconds * 100) / 100,
          },
          "HTTP request completed.",
        );
      });
      next();
    });
  };
}
