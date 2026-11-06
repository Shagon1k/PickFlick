import { constants } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { getSafeEnvironmentValidationFailures } from '@pickflick/config/environment';
import pino, { type Logger } from 'pino';

import { describeError } from '../common/describe-error.js';

const POLL_INTERVAL_MS = 5000;
const OWNER_READ_WRITE = 0o600;

interface IRunningWorker {
    runOnce: (now: Date, signal: AbortSignal) => Promise<void>;
    /** Releases connections after the last cycle. */
    stop: () => Promise<void>;
}

interface IPollingWorker {
    /** Names the logs (`deadline.worker.started`) and the Compose heartbeat file. */
    name: 'deadline' | 'email';
    start: (logger: Logger) => Promise<IRunningWorker>;
}

/** The process shell both workers share: signals, polling, heartbeat and safe failure logs. */
export async function runPollingWorker({ name, start }: IPollingWorker): Promise<void> {
    const logger = pino({ base: { service: `${name}-worker` } });
    const shutdown = new AbortController();
    process.once('SIGTERM', () => shutdown.abort());
    process.once('SIGINT', () => shutdown.abort());
    try {
        const worker = await start(logger);
        try {
            logger.info({ event: `${name}.worker.started` });
            await pollUntilAborted(
                async (now, signal) => {
                    await worker.runOnce(now, signal);
                    await writeHeartbeat(name);
                },
                shutdown.signal,
                (error) => logger.error({ event: `${name}.cycle.failed`, ...describeError(error) }),
            );
        } finally {
            await worker.stop();
            logger.info({ event: `${name}.worker.stopped` });
        }
    } catch (error) {
        const failures = getSafeEnvironmentValidationFailures(error);
        logger.fatal({
            event: `${name}.worker.failed`,
            ...(failures ? { failures } : describeError(error)),
        });
        process.exitCode = 1;
    }
}

/** Runs a cycle every five seconds; a failed cycle is logged and retried, shutdown lets one finish. */
export async function pollUntilAborted(
    runOnce: IRunningWorker['runOnce'],
    signal: AbortSignal,
    onCycleFailure: (error: unknown) => void,
): Promise<void> {
    while (!signal.aborted) {
        try {
            await runOnce(new Date(), signal);
        } catch (error) {
            onCycleFailure(error);
        }
        if (signal.aborted) break;
        try {
            await setTimeout(POLL_INTERVAL_MS, undefined, { signal });
        } catch (error) {
            if (!signal.aborted) throw error;
        }
    }
}

// Compose health checks read the file's timestamp; O_NOFOLLOW refuses a planted symlink.
async function writeHeartbeat(name: IPollingWorker['name']): Promise<void> {
    await writeFile(join(tmpdir(), `pickflick-${name}-worker`), String(Date.now()), {
        flag: constants.O_CREAT | constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW,
        mode: OWNER_READ_WRITE,
    });
}
