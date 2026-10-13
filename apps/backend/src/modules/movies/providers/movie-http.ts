import type { TMovieSource } from '@pickflick/contracts';
import type { z } from 'zod';

import { MovieProviderError } from './movie-provider.js';

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
                throw new MovieProviderError(
                    error.reason,
                    error.retryAt,
                    this.source,
                    error.reason === 'NOT_FOUND' ? [{ source: this.source }] : [],
                );
            throw new MovieProviderError(
                signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE',
                undefined,
                this.source,
            );
        }
    }
    private checkResponse(response: Response): void {
        if (response.status === 429) {
            const value = response.headers.get('retry-after');
            const delay =
                value && /^\d+$/u.test(value)
                    ? Number(value) * 1000
                    : Date.parse(value ?? '') - Date.now();
            const retryAt = new Date(
                Date.now() +
                    (Number.isFinite(delay) ? Math.max(1000, Math.min(delay, 86400000)) : 60000),
            );
            if (!this.retryAt || retryAt > this.retryAt) this.retryAt = retryAt;
            throw new MovieProviderError('RATE_LIMITED', this.retryAt, this.source);
        }
        if ([401, 403].includes(response.status)) throw new MovieProviderError('AUTHENTICATION');
        if (response.status === 404) throw new MovieProviderError('NOT_FOUND');
        if (response.status >= 500) throw new MovieProviderError('UNAVAILABLE');
        if (!response.ok) throw new MovieProviderError('INVALID_RESPONSE');
    }
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export async function readMovieResponse(response: Response, signal: AbortSignal): Promise<unknown> {
    if (!response.body) throw new MovieProviderError('INVALID_RESPONSE');
    const reader = response.body.getReader();
    let chunks: Uint8Array[];
    try {
        chunks = await readChunks(reader, signal);
    } finally {
        reader.releaseLock();
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
        throw new MovieProviderError('INVALID_RESPONSE');
    }
}

async function readChunks(reader: ReadableStreamDefaultReader<Uint8Array>, signal: AbortSignal) {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            const value: unknown = chunk.value;
            if (!(value instanceof Uint8Array)) throw new MovieProviderError('INVALID_RESPONSE');
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) {
                await reader.cancel().catch(() => {
                    throw new MovieProviderError('INVALID_RESPONSE');
                });
                throw new MovieProviderError('INVALID_RESPONSE');
            }
            chunks.push(value);
        }
    } catch (error) {
        if (error instanceof MovieProviderError) throw error;
        throw new MovieProviderError(signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE');
    }
    return chunks;
}
