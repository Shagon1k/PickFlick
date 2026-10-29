import 'reflect-metadata';

import { loadEmailWorkerEnvironment } from '@pickflick/config/environment';
import { createDatabaseClient } from '@pickflick/database';

import { ResendEmailClient } from './modules/email/resend-email.client.js';
import { EmailDispatcher } from './modules/notifications/email/email-dispatcher.js';
import { runPollingWorker } from './workers/polling-worker.js';

const ERROR_EVENTS = new Set(['email.failed', 'email.alert_failed']);

await runPollingWorker({
    name: 'email',
    start: async (logger) => {
        const environment = loadEmailWorkerEnvironment();
        const prisma = createDatabaseClient(environment.databaseUrl);
        await prisma.$queryRaw`SELECT 1`;
        logger.info({ event: 'email.delivery', deliveryEnabled: environment.deliveryEnabled });
        const dispatcher = new EmailDispatcher(
            prisma,
            new ResendEmailClient(environment.apiKey, environment.from),
            {
                environment,
                log: (fields) => {
                    if (ERROR_EVENTS.has(fields.event)) logger.error(fields);
                    else logger.info(fields);
                },
            },
        );
        return {
            runOnce: (now, signal) => dispatcher.runOnce(now, signal),
            stop: () => prisma.$disconnect(),
        };
    },
});
