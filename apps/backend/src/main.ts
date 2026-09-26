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

async function bootstrap(): Promise<void> {
    const environment = loadRuntimeEnvironment();
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(environment), {
        bodyParser: false,
        bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    configureApplication(app);
    await app.listen(environment.apiPort, environment.apiHost);
}

try {
    await bootstrap();
} catch (error) {
    // Environment failures name only the variable and rule, never its value.
    const failures = safeEnvironmentValidationFailures(error);
    process.stderr.write(
        `${JSON.stringify({
            level: 'fatal',
            service: 'backend',
            event: failures ? 'configuration.invalid' : 'service.start.failed',
            ...(failures ? { failures } : {}),
            time: new Date().toISOString(),
        })}\n`,
    );
    process.exitCode = 1;
}
