import { readTmdbResponse } from '../tmdb-response.js';

describe('readTmdbResponse', () => {
    it('should reject oversized responses even without a content-length header', async () => {
        const response = new Response('x'.repeat(4 * 1024 * 1024 + 1));
        await expect(
            readTmdbResponse(response, new AbortController().signal),
        ).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
    });

    it('should translate an interrupted body to a timeout without raw diagnostics', async () => {
        const controller = new AbortController();
        const stream = new ReadableStream<Uint8Array>({
            start(streamController) {
                streamController.enqueue(new TextEncoder().encode('{'));
                controller.signal.addEventListener('abort', () =>
                    streamController.error(new Error('private diagnostics')),
                );
            },
        });
        const result = readTmdbResponse(new Response(stream), controller.signal);
        controller.abort();
        await expect(result).rejects.toMatchObject({ reason: 'TIMEOUT' });
    });
});
