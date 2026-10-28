import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { z } from 'zod';

import {
    databaseEnvironmentSchema,
    emailWorkerEnvironmentSchema,
    runtimeEnvironmentSchema,
    type TDatabaseEnvironment,
    type TEmailWorkerEnvironment,
    type TRuntimeEnvironment,
} from './environment.schema.js';
import { notificationSignalEnvironmentSchema } from './notification-environment.schema.js';

export {
    APP_ENVIRONMENTS,
    type TDatabaseEnvironment,
    type TEmailWorkerEnvironment,
    type TRuntimeEnvironment,
} from './environment.schema.js';

export type TAppEnvironment = TDatabaseEnvironment['appEnvironment'];

type TEnvironmentSource = Record<string, string | undefined>;

/** Lists each invalid variable and its rule; never the supplied value. */
export class EnvironmentValidationError extends Error {
    constructor(readonly failures: string[]) {
        super(`Invalid environment configuration: ${failures.join('; ')}`);
        this.name = 'EnvironmentValidationError';
    }
}

export function getSafeEnvironmentValidationFailures(error: unknown): string[] | undefined {
    return error instanceof EnvironmentValidationError ? error.failures : undefined;
}

function parse<TSchema extends z.ZodType>(
    schema: TSchema,
    source: TEnvironmentSource,
): z.infer<TSchema> {
    const result = schema.safeParse(source);
    if (!result.success) {
        const failures = result.error.issues.map((issue) => {
            const name = String(issue.path[0] ?? 'environment');
            return `${name} ${issue.code === 'invalid_type' ? 'is required' : issue.message}`;
        });
        throw new EnvironmentValidationError([...new Set(failures)]);
    }
    return result.data;
}

export function parseDatabaseEnvironment(source: TEnvironmentSource): TDatabaseEnvironment {
    return parse(databaseEnvironmentSchema, source);
}

export function parseRuntimeEnvironment(source: TEnvironmentSource): TRuntimeEnvironment {
    return parse(runtimeEnvironmentSchema, source);
}

/** Loads the repository `.env` (or `PICKFLICK_ENV_FILE`) when present; deployed images use real env. */
export function loadRepositoryEnvironmentFile(source: TEnvironmentSource = process.env): void {
    const configuredPath = source.PICKFLICK_ENV_FILE?.trim();
    const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
    try {
        process.loadEnvFile(resolve(repositoryRoot, configuredPath || '.env'));
    } catch (error) {
        const code = error instanceof Error && 'code' in error ? error.code : undefined;
        if (code === 'ENOENT' && !configuredPath) {
            return;
        }
        throw new EnvironmentValidationError([
            `PICKFLICK_ENV_FILE ${code === 'ENOENT' ? 'does not exist' : 'could not be loaded'}`,
        ]);
    }
}

export function loadDatabaseEnvironment(): TDatabaseEnvironment {
    loadRepositoryEnvironmentFile();
    return parseDatabaseEnvironment(process.env);
}

export function loadRuntimeEnvironment(): TRuntimeEnvironment {
    loadRepositoryEnvironmentFile();
    return parseRuntimeEnvironment(process.env);
}

export function loadNotificationSignalEnvironment() {
    loadRepositoryEnvironmentFile();
    return parse(notificationSignalEnvironmentSchema, process.env);
}

export function loadEmailWorkerEnvironment(): TEmailWorkerEnvironment {
    loadRepositoryEnvironmentFile();
    return parse(emailWorkerEnvironmentSchema, process.env);
}
