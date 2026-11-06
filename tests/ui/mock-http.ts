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

type TMethod = 'GET' | 'POST' | 'PATCH';

/**
 * Returns which of `routes` (path suffix after `prefix` → its API method) the path names exactly,
 * or `undefined` so the next mock handler can try it.
 */
export function matchRoute<TRoute extends string>(
    pathname: string,
    prefix: string,
    routes: Record<TRoute, TMethod>,
): TRoute | undefined {
    const suffix = pathname.slice(prefix.length);
    return pathname.startsWith(prefix) && Object.hasOwn(routes, suffix)
        ? (suffix as TRoute)
        : undefined;
}

/** Answers 405 when the API does not accept the request's method on a matched route. */
export function rejectMethod(
    request: TMockRequest,
    response: TMockResponse,
    ...allowed: TMethod[]
): boolean {
    if (allowed.some((method) => method === request.method)) return false;
    response.writeHead(405, { allow: allowed.join(', ') }).end();
    return true;
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
