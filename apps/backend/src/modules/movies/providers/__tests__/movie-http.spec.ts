import { readMovieResponse } from '../movie-http.js';

describe('readMovieResponse', () => {
    it('should translate a body transport failure to unavailability without raw diagnostics', async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('{'));
            },
            pull(controller) {
                controller.error(new Error('private diagnostics'));
            },
        });
        await expect(
            readMovieResponse(new Response(stream), new AbortController().signal),
        ).rejects.toMatchObject({ reason: 'UNAVAILABLE', message: 'Movie provider: UNAVAILABLE' });
    });

    it('should reject malformed JSON as an invalid response', async () => {
        await expect(
            readMovieResponse(new Response('{broken'), new AbortController().signal),
        ).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
    });

    it('should reject oversized responses even without a content-length header', async () => {
        const response = new Response('x'.repeat(4 * 1024 * 1024 + 1));
        await expect(
            readMovieResponse(response, new AbortController().signal),
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
        const result = readMovieResponse(new Response(stream), controller.signal);
        controller.abort();
        await expect(result).rejects.toMatchObject({ reason: 'TIMEOUT' });
    });

    it('should keep an oversized body invalid even when cancellation fails', async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
            },
            cancel() {
                throw new Error('private transport diagnostics');
            },
        });
        await expect(
            readMovieResponse(new Response(stream), new AbortController().signal),
        ).rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
    });
});
