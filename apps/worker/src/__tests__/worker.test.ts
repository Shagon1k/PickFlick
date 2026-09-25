import { Writable } from 'node:stream';

import { createLogger, DrainController } from '@pickflick/observability';
import { describe, expect, it } from 'vitest';

import {
    executeCorrelatedJob,
    runWorker,
    WorkerDrainTimeoutError,
    WorkerNotReadyError,
    workerStatus,
} from '../worker.js';

function captureLogger() {
    let output = '';
    const destination = new Writable({
        write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
        },
    });
    return {
        logger: createLogger({ service: 'worker', environment: 'test', destination }),
        output: () => output,
    };
}

describe('worker scaffold', () => {
    it('starts and stops through an abort signal', async () => {
        const logs = captureLogger();
        const controller = new AbortController();
        const drain = new DrainController();
        const running = runWorker(controller.signal, {
            logger: logs.logger,
            readiness: async () => ({ status: 'ready', checks: [] }),
            drain,
            shutdownTimeoutMilliseconds: 100,
        });

        await new Promise<void>((resolve) => setImmediate(resolve));
        controller.abort();

        await expect(running).resolves.toBeUndefined();
        expect(workerStatus).toEqual({ service: 'worker', status: 'scaffold' });
        expect(logs.output()).toContain('"event":"service.ready"');
        expect(logs.output()).toContain('"event":"service.stopped"');
    });

    it('refuses readiness when a required dependency is unavailable', async () => {
        const logs = captureLogger();
        const controller = new AbortController();

        await expect(
            runWorker(controller.signal, {
                logger: logs.logger,
                readiness: async () => ({
                    status: 'not_ready',
                    checks: [{ name: 'redis', status: 'down' }],
                }),
                drain: new DrainController(),
                shutdownTimeoutMilliseconds: 100,
            }),
        ).rejects.toThrow(WorkerNotReadyError);
        expect(logs.output()).toContain('"unavailableDependencies":["redis"]');
    });

    it('correlates job lifecycle logs without logging handler failures', async () => {
        const logs = captureLogger();
        const drain = new DrainController();

        await expect(
            executeCorrelatedJob(
                { id: 'job-42', correlationId: '123e4567-e89b-42d3-a456-426614174000' },
                logs.logger,
                drain,
                async () => {
                    throw new Error('private payload');
                },
            ),
        ).rejects.toThrow('private payload');

        expect(logs.output()).toContain('"jobId":"job-42"');
        expect(logs.output()).toContain('"correlationId":"123e4567-e89b-42d3-a456-426614174000"');
        expect(logs.output()).not.toContain('private payload');
    });

    it('drains active jobs before stopping', async () => {
        const logs = captureLogger();
        const controller = new AbortController();
        const drain = new DrainController();
        let finishJob!: () => void;
        const running = runWorker(controller.signal, {
            logger: logs.logger,
            readiness: async () => ({ status: 'ready', checks: [] }),
            drain,
            shutdownTimeoutMilliseconds: 1_000,
        });

        await new Promise<void>((resolve) => setImmediate(resolve));
        const activeJob = executeCorrelatedJob(
            { id: 'job-drain' },
            logs.logger,
            drain,
            () => new Promise<void>((resolve) => (finishJob = resolve)),
        );
        controller.abort();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(logs.output()).toContain('"event":"service.draining"');
        expect(logs.output()).not.toContain('"event":"service.stopped"');

        finishJob();
        await activeJob;
        await expect(running).resolves.toBeUndefined();
        expect(logs.output()).toContain('"event":"service.stopped"');
    });

    it('fails when active work exceeds the drain deadline', async () => {
        const logs = captureLogger();
        const controller = new AbortController();
        const drain = new DrainController();
        void drain.run(() => new Promise(() => undefined));
        const running = runWorker(controller.signal, {
            logger: logs.logger,
            readiness: async () => ({ status: 'ready', checks: [] }),
            drain,
            shutdownTimeoutMilliseconds: 5,
        });

        await new Promise<void>((resolve) => setImmediate(resolve));
        controller.abort();

        await expect(running).rejects.toThrow(WorkerDrainTimeoutError);
        expect(logs.output()).toContain('"event":"service.shutdown.timeout"');
    });

    it('starts the shutdown deadline while the Contact loop has in-flight work', async () => {
        const logs = captureLogger();
        const controller = new AbortController();
        const drain = new DrainController();
        let workStarted!: () => void;
        const started = new Promise<void>((resolve) => (workStarted = resolve));
        const running = runWorker(controller.signal, {
            logger: logs.logger,
            readiness: async () => ({ status: 'ready', checks: [] }),
            drain,
            shutdownTimeoutMilliseconds: 5,
            work: async () => {
                await drain.run(async () => {
                    workStarted();
                    await new Promise(() => undefined);
                });
            },
        });

        await started;
        controller.abort();

        await expect(running).rejects.toThrow(WorkerDrainTimeoutError);
        expect(logs.output()).toContain('"event":"service.draining"');
        expect(logs.output()).toContain('"event":"service.shutdown.timeout"');
    });
});
