import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TApiErrorCode } from '@pickflick/contracts';

/** Every mock route receives the raw Node request and response. */
export type TMockRequest = IncomingMessage;
export type TMockResponse = ServerResponse;

export function sendJson(response: TMockResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
}

export function sendError(
    response: TMockResponse,
    status: number,
    code: TApiErrorCode,
    requestId: string,
    reason?: string,
): void {
    sendJson(response, status, {
        error: { code, message: code, requestId, ...(reason ? { reason } : {}) },
    });
}

/** Reads a JSON request body; the caller names the shape it expects from the frontend. */
export function readJson<TBody = Record<string, unknown>>(
    request: TMockRequest,
    onBody: (body: TBody) => void,
): void {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () => onBody(JSON.parse(body) as TBody));
}
