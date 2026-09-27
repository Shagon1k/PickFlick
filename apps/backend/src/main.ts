import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
    loadRuntimeEnvironment,
    safeEnvironmentValidationFailures,
} from '@pickflick/config/environment';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configureApplication } from './config/configure-application.js';

/** Writes one structured line to stderr; the pino logger may not exist yet or may be the failure. */
function writeFatal(event: string, fields: Record<string, unknown> = {}): void {
    const line = { level: 'fatal', service: 'backend', event, ...fields };
    process.stderr.write(`${JSON.stringify({ ...line, time: new Date().toISOString() })}\n`);
}

// Node exits on an unhandled rejection anyway; record why first so the log shows the cause.
process.on('unhandledRejection', (reason) => {
    writeFatal('process.unhandled_rejection', {
        error: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
    });
    process.exit(1);
});

async function bootstrap(): Promise<void> {
    const environment = loadRuntimeEnvironment();
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(environment), {
        bodyParser: false,
        bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    configureApplication(app);
    await app.listen(environment.backendPort, environment.backendHost);
}

try {
    await bootstrap();
} catch (error) {
    // Environment failures name only the variable and rule, never its value.
    const failures = safeEnvironmentValidationFailures(error);
    writeFatal(
        failures ? 'configuration.invalid' : 'service.start.failed',
        failures ? { failures } : {},
    );
    process.exitCode = 1;
}
