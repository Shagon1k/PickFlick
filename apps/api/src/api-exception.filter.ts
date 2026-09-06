import { Catch, HttpException, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiErrorCode, ApiErrorEnvelope } from "@pickflick/contracts";
import { currentCorrelationContext, resolveCorrelationId, type ApplicationLogger } from "@pickflick/observability";

interface ErrorDefinition {
  readonly code: ApiErrorCode;
  readonly message: string;
}

interface HttpResponse {
  getHeader(name: string): number | string | string[] | undefined;
  status(statusCode: number): HttpResponse;
  json(body: ApiErrorEnvelope): void;
}

const definitions: Partial<Record<number, ErrorDefinition>> = {
  [HttpStatus.BAD_REQUEST]: { code: "VALIDATION_FAILED", message: "Request validation failed." },
  [HttpStatus.UNAUTHORIZED]: { code: "UNAUTHORIZED", message: "Authentication is required." },
  [HttpStatus.FORBIDDEN]: { code: "FORBIDDEN", message: "This action is not allowed." },
  [HttpStatus.NOT_FOUND]: { code: "NOT_FOUND", message: "Resource not found." },
  [HttpStatus.METHOD_NOT_ALLOWED]: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
  [HttpStatus.CONFLICT]: { code: "CONFLICT", message: "The request conflicts with current state." },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: "PAYLOAD_TOO_LARGE", message: "Request payload is too large." },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
    code: "UNSUPPORTED_MEDIA_TYPE",
    message: "Request media type is not supported.",
  },
  [HttpStatus.TOO_MANY_REQUESTS]: { code: "RATE_LIMITED", message: "Too many requests." },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: "SERVICE_UNAVAILABLE",
    message: "The service is temporarily unavailable.",
  },
};

function errorDefinition(statusCode: number): ErrorDefinition {
  return (
    definitions[statusCode] ??
    (statusCode >= 500
      ? { code: "INTERNAL_ERROR", message: "An unexpected error occurred." }
      : { code: "REQUEST_FAILED", message: "The request could not be completed." })
  );
}

function responseRequestId(response: HttpResponse): string | undefined {
  const value = response.getHeader("x-request-id");
  return typeof value === "string" ? value : undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ApplicationLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const definition = errorDefinition(statusCode);
    const requestId =
      currentCorrelationContext()?.requestId ?? resolveCorrelationId(responseRequestId(response));
    const fields = { event: "http.request.failed", requestId, statusCode, errorCode: definition.code };

    if (statusCode >= 500) this.logger.error(fields, "HTTP request failed.");
    else this.logger.warn(fields, "HTTP request rejected.");

    response.status(statusCode).json({
      error: {
        ...definition,
        requestId,
      },
    });
  }
}
