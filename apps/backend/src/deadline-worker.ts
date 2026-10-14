import 'reflect-metadata';

import { constants } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    getSafeEnvironmentValidationFailures,
    loadDatabaseEnvironment,
} from '@pickflick/config/environment';
import { createDatabaseClient } from '@pickflick/database';
import pino from 'pino';

import { runDeadlineWorker } from './deadline-worker-loop.js';
import { NominationDeadlines } from './modules/sessions/nominations/nomination-deadlines.js';

const OWNER_READ_WRITE = 0o600;

const logger = pino({ base: { service: 'deadline-worker' } });
const shutdown = new AbortController();
process.once('SIGTERM', () => shutdown.abort());
process.once('SIGINT', () => shutdown.abort());

try {
    const environment = loadDatabaseEnvironment();
    const prisma = createDatabaseClient(environment.databaseUrl);
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info({ event: 'deadline.worker.started' });
        const deadlines = new NominationDeadlines(prisma, (fields) => {
            if (fields.event === 'deadline.failure') logger.error(fields);
            else logger.info(fields);
        });
        await runDeadlineWorker(
            {
                runOnce: async (now, signal) => {
                    await deadlines.runOnce(now, signal);
                    await writeFile(
                        join(tmpdir(), 'pickflick-deadline-worker'),
                        String(Date.now()),
                        {
                            flag:
                                constants.O_CREAT |
                                constants.O_WRONLY |
                                constants.O_TRUNC |
                                constants.O_NOFOLLOW,
                            mode: OWNER_READ_WRITE,
                        },
                    );
                },
            },
            shutdown.signal,
            (event) => logger.error({ event }),
        );
    } finally {
        await prisma.$disconnect();
        logger.info({ event: 'deadline.worker.stopped' });
    }
} catch (error) {
    logger.fatal({
        event: 'deadline.worker.failed',
        failures: getSafeEnvironmentValidationFailures(error),
    });
    process.exitCode = 1;
}
