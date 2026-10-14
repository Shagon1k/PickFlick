import { randomUUID } from 'node:crypto';

import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    HttpException,
    Logger,
} from '@nestjs/common';
import { HTTP_STATUS, type IApiErrorEnvelope, type TApiErrorCode } from '@pickflick/contracts';
import type { Request, Response } from 'express';

const errors: Partial<Record<number, { code: TApiErrorCode; message: string }>> = {
    [HTTP_STATUS.BAD_REQUEST]: { code: 'VALIDATION_FAILED', message: 'Request validation failed.' },
    [HTTP_STATUS.UNAUTHORIZED]: { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
    [HTTP_STATUS.FORBIDDEN]: { code: 'FORBIDDEN', message: 'This action is not allowed.' },
    [HTTP_STATUS.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Resource not found.' },
    [HTTP_STATUS.METHOD_NOT_ALLOWED]: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.',
    },
    [HTTP_STATUS.CONFLICT]: {
        code: 'CONFLICT',
        message: 'The request conflicts with current state.',
    },
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
    },
    [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Request media type is not supported.',
    },
    [HTTP_STATUS.TOO_MANY_REQUESTS]: { code: 'RATE_LIMITED', message: 'Too many requests.' },
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
    },
};

const LAST_HTTP_STATUS = 599;

function getErrorStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
        return exception.getStatus();
    }
    // Body-parser errors carry a status (400 for bad JSON, 413 for oversize) but aren't HttpExceptions.
    const status = (exception as { status?: unknown } | null)?.status;
    return typeof status === 'number' &&
        status >= HTTP_STATUS.BAD_REQUEST &&
        status <= LAST_HTTP_STATUS
        ? status
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/** Passes through only a stable upper-case reason code, never free-form exception text. */
function getErrorReason(exception: unknown): string | undefined {
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const reason = typeof body === 'object' && 'reason' in body ? body.reason : undefined;
    return typeof reason === 'string' && /^[A-Z][A-Z_]{0,63}$/u.test(reason) ? reason : undefined;
}

/** Every error leaves the API as the same safe envelope; details stay in the logs. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ApiExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const request = host.switchToHttp().getRequest<Request & { id?: unknown }>();
        const response = host.switchToHttp().getResponse<Response>();
        const status = getErrorStatus(exception);
        const known = errors[status];
        const error =
            known ??
            (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR
                ? { code: 'INTERNAL_ERROR' as const, message: 'An unexpected error occurred.' }
                : {
                      code: 'REQUEST_FAILED' as const,
                      message: 'The request could not be completed.',
                  });

        if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
            this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        }

        const reason = getErrorReason(exception);
        const body: IApiErrorEnvelope = {
            error: {
                ...error,
                requestId: typeof request.id === 'string' ? request.id : randomUUID(),
                ...(reason ? { reason } : {}),
            },
        };
        response.status(status).json(body);
    }
}
