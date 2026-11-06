import { describeError } from '../../common/describe-error.js';
import { pollUntilAborted } from '../polling-worker.js';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));

describe('pollUntilAborted', () => {
    it('should finish the current cycle and stop accepting work on shutdown', async () => {
        const shutdown = new AbortController();
        let finish!: () => void;
        const cycle = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const runOnce = vi.fn(() => cycle);
        const onFailure = vi.fn();
        const running = pollUntilAborted(runOnce, shutdown.signal, onFailure);
        shutdown.abort();
        finish();
        await running;
        expect(runOnce).toHaveBeenCalledExactlyOnceWith(expect.any(Date), shutdown.signal);
        expect(onFailure).not.toHaveBeenCalled();
    });

    it('should report a failed cycle and retry pending work on the next poll', async () => {
        const shutdown = new AbortController();
        const failure = new TypeError('private connection URL');
        const runOnce = vi
            .fn()
            .mockRejectedValueOnce(failure)
            .mockImplementationOnce(() => {
                shutdown.abort();
                return Promise.resolve();
            });
        const onFailure = vi.fn();
        await pollUntilAborted(runOnce, shutdown.signal, onFailure);
        expect(runOnce).toHaveBeenCalledTimes(2);
        expect(onFailure).toHaveBeenCalledExactlyOnceWith(failure);
    });
});

describe('describeError', () => {
    it('should keep the error class and drop its message', () => {
        expect(describeError(new TypeError('private connection URL'))).toEqual({
            errorName: 'TypeError',
        });
    });

    it('should keep a machine code such as a Node system error code', () => {
        const busy = Object.assign(new Error('listen EADDRINUSE 127.0.0.1:3001'), {
            code: 'EADDRINUSE',
        });
        expect(describeError(busy)).toEqual({ errorName: 'Error', errorCode: 'EADDRINUSE' });
    });
});
