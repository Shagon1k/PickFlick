import { runDeadlineWorker } from '../deadline-worker-loop.js';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));

describe('runDeadlineWorker', () => {
    it('should finish the current transaction and stop accepting work on shutdown', async () => {
        const shutdown = new AbortController();
        let finish!: () => void;
        const transaction = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const runOnce = vi.fn(() => transaction);
        const log = vi.fn();
        const running = runDeadlineWorker({ runOnce }, shutdown.signal, log);
        shutdown.abort();
        finish();
        await running;
        expect(runOnce).toHaveBeenCalledExactlyOnceWith(expect.any(Date), shutdown.signal);
        expect(log).not.toHaveBeenCalled();
    });

    it('should log a safe cycle failure and retry pending work on the next poll', async () => {
        const shutdown = new AbortController();
        const runOnce = vi
            .fn()
            .mockRejectedValueOnce(new Error('private connection URL'))
            .mockImplementationOnce(() => {
                shutdown.abort();
                return Promise.resolve();
            });
        const log = vi.fn();
        const running = runDeadlineWorker({ runOnce }, shutdown.signal, log);
        await running;
        expect(runOnce).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenCalledExactlyOnceWith('deadline.cycle.failed');
    });
});
