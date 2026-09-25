import { ArgumentsHost, ConflictException, NotFoundException } from '@nestjs/common';

import { ApiExceptionFilter } from '../api-exception.filter.js';

function capture(exception: unknown) {
    const json = vi.fn<(body: unknown) => void>();
    const status = vi.fn<(code: number) => { json: typeof json }>(() => ({ json }));
    const host = {
        switchToHttp: () => ({
            getRequest: () => ({ id: 'request-1' }),
            getResponse: () => ({ status }),
        }),
    } as unknown as ArgumentsHost;
    new ApiExceptionFilter().catch(exception, host);
    return {
        status: status.mock.calls[0]?.[0],
        body: json.mock.calls[0]?.[0] as { error: Record<string, unknown> },
    };
}

describe('ApiExceptionFilter', () => {
    it('should map a Nest exception to the safe envelope', () => {
        expect(capture(new NotFoundException('secret detail'))).toEqual({
            status: 404,
            body: {
                error: {
                    code: 'NOT_FOUND',
                    message: 'Resource not found.',
                    requestId: 'request-1',
                },
            },
        });
    });

    it('should pass through only a stable conflict reason', () => {
        expect(
            capture(new ConflictException({ reason: 'SESSION_HISTORY' })).body.error.reason,
        ).toBe('SESSION_HISTORY');
        expect(
            capture(new ConflictException({ reason: 'free text' })).body.error,
        ).not.toHaveProperty('reason');
    });

    it('should hide unexpected errors behind a 500', () => {
        expect(capture(new Error('database password'))).toMatchObject({
            status: 500,
            body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
        });
    });

    it('should keep a body-parser status such as 413', () => {
        expect(capture(Object.assign(new Error('too large'), { status: 413 })).status).toBe(413);
    });
});
