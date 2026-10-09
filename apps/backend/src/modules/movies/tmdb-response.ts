import { MovieProviderError } from './movie-provider.js';

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export async function readTmdbResponse(response: Response, signal: AbortSignal): Promise<unknown> {
    if (!response.body) {
        throw new MovieProviderError('INVALID_RESPONSE');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            const value: unknown = chunk.value;
            if (!(value instanceof Uint8Array)) {
                throw new MovieProviderError('INVALID_RESPONSE');
            }
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                throw new MovieProviderError('INVALID_RESPONSE');
            }
            chunks.push(value);
        }
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return body;
    } catch (error) {
        if (error instanceof MovieProviderError) {
            throw error;
        }
        throw new MovieProviderError(signal.aborted ? 'TIMEOUT' : 'INVALID_RESPONSE');
    } finally {
        reader.releaseLock();
    }
}
