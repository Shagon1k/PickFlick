import 'reflect-metadata';

import {
    loadDatabaseEnvironment,
    loadNotificationSignalEnvironment,
} from '@pickflick/config/environment';
import { createDatabaseClient } from '@pickflick/database';

import { NotificationSignals } from './modules/notifications/notification-signals.js';
import { NotificationTransactions } from './modules/notifications/notification-transactions.js';
import { NominationDeadlines } from './modules/sessions/nominations/nomination-deadlines.js';
import { runPollingWorker } from './workers/polling-worker.js';

await runPollingWorker({
    name: 'deadline',
    start: async (logger) => {
        const prisma = createDatabaseClient(loadDatabaseEnvironment().databaseUrl);
        const signals = new NotificationSignals(loadNotificationSignalEnvironment());
        // Outside Nest, the worker calls the module lifecycle hooks itself.
        signals.onModuleInit();
        await prisma.$queryRaw`SELECT 1`;
        const deadlines = new NominationDeadlines(
            prisma,
            (fields) => {
                if (fields.event === 'deadline.failure') logger.error(fields);
                else logger.info(fields);
            },
            new NotificationTransactions(prisma, signals),
        );
        return {
            runOnce: (now, signal) => deadlines.runOnce(now, signal),
            stop: async () => {
                signals.onModuleDestroy();
                await prisma.$disconnect();
            },
        };
    },
});
