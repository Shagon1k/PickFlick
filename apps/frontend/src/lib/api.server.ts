import 'server-only';

import type { IApiErrorEnvelope } from '@pickflick/contracts';
import { headers } from 'next/headers';

const DEFAULT_TIMEOUT_MS = 10_000;

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001';

// The API needs the visitor's session cookie and real client address, not the web server's.
const FORWARDED_HEADERS = ['cookie', 'cf-connecting-ip', 'x-forwarded-for'];

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code?: string,
        readonly reason?: string,
    ) {
        super(`API request failed with HTTP ${status}.`);
        this.name = 'ApiError';
    }
}

interface IApiRequestInit {
    timeoutMs?: number;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    json?: unknown;
    body?: ArrayBuffer;
    contentType?: string;
}

// Encoding leaves these unchanged, and URL resolution would turn them into a move up the path.
const DOT_SEGMENTS = new Set(['.', '..']);

/**
 * An API path whose interpolated values are each encoded as one path segment, so an ID taken from a
 * URL or a server action argument cannot add or remove segments. The API validates the IDs
 * themselves.
 */
export function apiPath(parts: TemplateStringsArray, ...segments: string[]): string {
    return parts.reduce((path, part, index) => {
        const segment = segments[index] ?? '';
        if (DOT_SEGMENTS.has(segment))
            throw new Error('An API path segment cannot be a dot segment.');
        return path + part + encodeURIComponent(segment);
    }, '');
}

/** The visitor's cookie and client address, so the API rate-limits each visitor separately. */
export function buildVisitorHeaders(incoming: Headers): Headers {
    const outgoing = new Headers();
    for (const name of FORWARDED_HEADERS) {
        const value = incoming.get(name);
        if (value) {
            outgoing.set(name, value);
        }
    }
    return outgoing;
}

/** Calls the API from the server as the current visitor. Throws `ApiError` for any non-2xx. */
export async function requestApi<TResponse = void>(
    path: string,
    init: IApiRequestInit = {},
    incomingHeaders?: Headers,
): Promise<TResponse> {
    const outgoing = buildVisitorHeaders(incomingHeaders ?? (await headers()));
    const contentType = init.json === undefined ? init.contentType : 'application/json';
    if (contentType) {
        outgoing.set('content-type', contentType);
    }

    const response = await fetch(new URL(path, BACKEND_URL), {
        method: init.method ?? 'GET',
        headers: outgoing,
        body: init.json === undefined ? init.body : JSON.stringify(init.json),
        cache: 'no-store',
        signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
        const envelope = (await response.json().catch(() => undefined)) as
            | IApiErrorEnvelope
            | undefined;
        throw new ApiError(response.status, envelope?.error.code, envelope?.error.reason);
    }
    // 202 and 204 answers carry no body.
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as TResponse;
}
