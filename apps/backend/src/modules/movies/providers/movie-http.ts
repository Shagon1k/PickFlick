import { HTTP_STATUS, type TMovieSource } from '@pickflick/contracts';
import type { z } from 'zod';

import { MovieProviderError } from './movie-provider.js';

const SECOND_MS = 1000;
// A provider's Retry-After is honored between one second and one day; a missing one waits a minute.
const MIN_RETRY_MS = SECOND_MS;
const MAX_RETRY_MS = 24 * 60 * 60 * SECOND_MS;
const DEFAULT_RETRY_MS = 60 * SECOND_MS;

export class MovieHttp {
    private retryAt?: Date;
    constructor(
        private source: TMovieSource,
        private origin: string,
        private timeoutMs: number,
        private request: typeof fetch = fetch,
    ) {}
    async get<TData>(
        path: string,
        schema: z.ZodType<TData>,
        headers: Record<string, string>,
    ): Promise<TData> {
        if (this.retryAt && this.retryAt.getTime() > Date.now())
            throw new MovieProviderError('RATE_LIMITED', this.retryAt, this.source);
        const signal = AbortSignal.timeout(this.timeoutMs);
        try {
            const response = await this.request(new URL(path, this.origin), {
                headers,
                signal,
                redirect: 'error',
            });
            this.checkResponse(response);
            const body = await readMovieResponse(response, signal);
            const parsed = schema.safeParse(body);
            if (!parsed.success) throw new MovieProviderError('INVALID_RESPONSE');
            return parsed.data;
        } catch (error) {
            if (error instanceof MovieProviderError)
                throw new MovieProviderError(error.reason, error.retryAt, this.source);
            throw new MovieProviderError(
                signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE',
                undefined,
                this.source,
            );
        }
    }
    private checkResponse(response: Response): void {
        if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
            const value = response.headers.get('retry-after');
            const delay =
                value && /^\d+$/u.test(value)
                    ? Number(value) * SECOND_MS
                    : Date.parse(value ?? '') - Date.now();
            const retryAt = new Date(
                Date.now() +
                    (Number.isFinite(delay)
                        ? Math.max(MIN_RETRY_MS, Math.min(delay, MAX_RETRY_MS))
                        : DEFAULT_RETRY_MS),
            );
            if (!this.retryAt || retryAt > this.retryAt) this.retryAt = retryAt;
            throw new MovieProviderError('RATE_LIMITED', this.retryAt, this.source);
        }
        if ([HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.FORBIDDEN].includes(response.status))
            throw new MovieProviderError('AUTHENTICATION');
        if (response.status === HTTP_STATUS.NOT_FOUND) throw new MovieProviderError('NOT_FOUND');
        if (response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR)
            throw new MovieProviderError('UNAVAILABLE');
        if (!response.ok) throw new MovieProviderError('INVALID_RESPONSE');
    }
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

class BodyTooLargeError extends Error {}

/** Reads a whole body but stops once it exceeds `maxBytes`, even without a content-length. */
export async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
    if (!response.body) return Buffer.alloc(0);
    // Node types fetch bodies loosely; undici always yields byte chunks.
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks);
            bytes += value.byteLength;
            if (bytes > maxBytes) throw new BodyTooLargeError();
            chunks.push(value);
        }
    } finally {
        // Cancelling a finished or failed stream can itself fail; the read outcome stands.
        await reader.cancel().catch(() => undefined);
    }
}

export async function readMovieResponse(response: Response, signal: AbortSignal): Promise<unknown> {
    let body: Buffer;
    try {
        body = await readBoundedBody(response, MAX_RESPONSE_BYTES);
    } catch (error) {
        if (error instanceof BodyTooLargeError) throw new MovieProviderError('INVALID_RESPONSE');
        throw new MovieProviderError(signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
    }
    try {
        return JSON.parse(body.toString('utf8')) as unknown;
    } catch {
        throw new MovieProviderError('INVALID_RESPONSE');
    }
}
