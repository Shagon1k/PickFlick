import pino, { type DestinationStream, type Logger } from 'pino';

import type { DeploymentEnvironment } from '@pickflick/config/environment';
import type { ServiceName } from '@pickflick/contracts';

import { currentCorrelationContext } from './correlation.js';

const redactedValue = '[Redacted]';
const sensitiveKeys = [
    'authorization',
    'cookie',
    'set-cookie',
    'password',
    'token',
    'accessToken',
    'apiKey',
    'hashSecret',
    'refreshToken',
    'secret',
    'secretAccessKey',
    'databaseUrl',
    'redisUrl',
];

const redactionPaths = sensitiveKeys.flatMap((key) => [
    key,
    `*.${key}`,
    `*.*.${key}`,
    `*.*.*.${key}`,
]);

export type ApplicationLogger = Logger;

export interface LoggerOptions {
    readonly service: ServiceName;
    readonly environment: DeploymentEnvironment;
    readonly destination?: DestinationStream;
}

export function createLogger(options: LoggerOptions): ApplicationLogger {
    return pino(
        {
            base: {
                service: options.service,
                environment: options.environment,
            },
            formatters: {
                level: (label) => ({ level: label }),
            },
            messageKey: 'message',
            mixin: () => ({ ...currentCorrelationContext() }),
            redact: {
                paths: redactionPaths,
                censor: redactedValue,
            },
            timestamp: pino.stdTimeFunctions.isoTime,
        },
        options.destination,
    );
}
