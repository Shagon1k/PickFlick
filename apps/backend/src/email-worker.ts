import 'reflect-metadata';

import { constants } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    getSafeEnvironmentValidationFailures,
    loadEmailWorkerEnvironment,
} from '@pickflick/config/environment';
import { createDatabaseClient } from '@pickflick/database';
import pino from 'pino';

import { runDeadlineWorker } from './deadline-worker-loop.js';
import { ResendEmailClient } from './modules/email/resend-email.client.js';
import { EmailDispatcher } from './modules/notifications/email/email-dispatcher.js';

const OWNER_READ_WRITE = 0o600;
const logger = pino({ base: { service: 'email-worker' } });
const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());
process.once('SIGINT', () => shutdown.abort());

try {
    const environment = loadEmailWorkerEnvironment();
    const prisma = createDatabaseClient(environment.databaseUrl);
    try {
        await prisma.$queryRaw`SELECT 1`;
        const dispatcher = new EmailDispatcher(
            prisma,
            new ResendEmailClient(environment.apiKey, environment.from),
            {
                environment,
                log: (fields) => {
                    if (['email.failed', 'email.alert_failed'].includes(fields.event))
                        logger.error(fields);
                    else logger.info(fields);
                },
            },
        );
        logger.info({
            event: 'email.worker.started',
            deliveryEnabled: environment.deliveryEnabled,
        });
        await runDeadlineWorker(
            {
                runOnce: async (now, signal) => {
                    await dispatcher.runOnce(now, signal);
                    await writeFile(join(tmpdir(), 'pickflick-email-worker'), String(Date.now()), {
                        flag:
                            constants.O_CREAT |
                            constants.O_WRONLY |
                            constants.O_TRUNC |
                            constants.O_NOFOLLOW,
                        mode: OWNER_READ_WRITE,
                    });
                },
            },
            shutdown.signal,
            () => logger.error({ event: 'email.cycle.failed' }),
        );
    } finally {
        await prisma.$disconnect();
        logger.info({ event: 'email.worker.stopped' });
    }
} catch (error) {
    logger.fatal({
        event: 'email.worker.failed',
        failures: getSafeEnvironmentValidationFailures(error),
    });
    process.exitCode = 1;
}
