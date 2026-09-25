import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    boolean,
    durationMilliseconds,
    integer,
    oneOf,
    optionalBoolean,
    originUrl,
    required,
    url,
} from './environment.fields.js';
import {
    DEPLOYMENT_ENVIRONMENTS,
    EnvironmentValidationError,
    RESEND_DELIVERY_MODES,
    type DatabaseEnvironment,
    type DeploymentEnvironment,
    type EnvironmentSource,
    type RuntimeEnvironment,
    type ValidationFailure,
    type WorkerEnvironment,
} from './environment.types.js';
import {
    validateApplePrivateKey,
    validateContactMailboxes,
    validateResendDelivery,
    validateStorageBucket,
} from './environment.validation.js';

export {
    DEPLOYMENT_ENVIRONMENTS,
    EnvironmentValidationError,
    RESEND_DELIVERY_MODES,
    safeEnvironmentValidationFailures,
    type DatabaseEnvironment,
    type DeploymentEnvironment,
    type ResendDeliveryMode,
    type RuntimeEnvironment,
    type WorkerEnvironment,
} from './environment.types.js';

export function parseDatabaseEnvironment(source: EnvironmentSource): DatabaseEnvironment {
    const failures: ValidationFailure[] = [];
    const result: DatabaseEnvironment = {
        appEnvironment: oneOf(source, 'APP_ENV', DEPLOYMENT_ENVIRONMENTS, failures),
        databaseUrl: url(
            source,
            'DATABASE_URL',
            ['postgresql:', 'postgres:'],
            failures,
            'host-and-path',
        ),
    };
    if (failures.length > 0) {
        throw new EnvironmentValidationError(failures);
    }
    return result;
}

function parseWorkerValues(
    source: EnvironmentSource,
    appEnvironment: DeploymentEnvironment,
    failures: ValidationFailure[],
): WorkerEnvironment {
    const sourceRevision = source.SOURCE_REVISION?.trim();
    if (sourceRevision && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(sourceRevision)) {
        failures.push({
            name: 'SOURCE_REVISION',
            reason: 'must be a full hexadecimal source revision',
        });
    }

    const databaseUrl = url(
        source,
        'DATABASE_URL',
        ['postgresql:', 'postgres:'],
        failures,
        'host-and-path',
    );
    const shutdownTimeoutMilliseconds = durationMilliseconds(
        source,
        'SHUTDOWN_TIMEOUT_MS',
        failures,
    );
    const redisUrl = url(source, 'REDIS_URL', ['redis:', 'rediss:'], failures, 'host');
    const endpoint = url(source, 'STORAGE_ENDPOINT', ['http:', 'https:'], failures);
    const region = required(source, 'STORAGE_REGION', failures);
    const bucket = required(source, 'STORAGE_BUCKET', failures);
    const accessKey = required(source, 'STORAGE_ACCESS_KEY', failures);
    const secretKey = required(source, 'STORAGE_SECRET_KEY', failures);
    const forcePathStyle = boolean(source, 'STORAGE_FORCE_PATH_STYLE', failures);
    const resendDeliveryMode = oneOf(
        source,
        'RESEND_DELIVERY_MODE',
        RESEND_DELIVERY_MODES,
        failures,
    );
    const resendApiKey = required(source, 'RESEND_API_KEY', failures);
    const from = required(source, 'RESEND_FROM', failures);
    const contactDeliveryTo = required(source, 'CONTACT_DELIVERY_TO', failures);
    const contactHashSecret = required(source, 'CONTACT_HASH_SECRET', failures);

    validateStorageBucket(bucket, failures);
    validateContactMailboxes(appEnvironment, from, contactDeliveryTo, failures);
    validateResendDelivery(appEnvironment, resendDeliveryMode, resendApiKey, failures);
    if (contactHashSecret && contactHashSecret.length < 32) {
        failures.push({
            name: 'CONTACT_HASH_SECRET',
            reason: 'must contain at least 32 characters',
        });
    }
    return {
        appEnvironment,
        ...(sourceRevision ? { sourceRevision } : {}),
        databaseUrl,
        shutdownTimeoutMilliseconds,
        redisUrl,
        storage: { endpoint, region, bucket, accessKey, secretKey, forcePathStyle },
        resend: {
            apiKey: resendApiKey,
            from,
            deliveryMode: resendDeliveryMode,
            deliveryEnabled: resendDeliveryMode === 'live',
        },
        contact: { deliveryTo: contactDeliveryTo, hashSecret: contactHashSecret },
    };
}

export function parseWorkerEnvironment(source: EnvironmentSource): WorkerEnvironment {
    const failures: ValidationFailure[] = [];
    const appEnvironment = oneOf(source, 'APP_ENV', DEPLOYMENT_ENVIRONMENTS, failures);
    const result = parseWorkerValues(source, appEnvironment, failures);
    if (failures.length > 0) {
        throw new EnvironmentValidationError(failures);
    }
    return result;
}

export function parseRuntimeEnvironment(source: EnvironmentSource): RuntimeEnvironment {
    const failures: ValidationFailure[] = [];
    const appEnvironment = oneOf(source, 'APP_ENV', DEPLOYMENT_ENVIRONMENTS, failures);
    const apiHost = required(source, 'API_HOST', failures);
    const apiPort = integer(source, 'API_PORT', failures);
    const workerEnvironment = parseWorkerValues(source, appEnvironment, failures);
    const authBaseUrl = originUrl(source, 'AUTH_BASE_URL', appEnvironment, failures);
    const authSecret = required(source, 'AUTH_SECRET', failures);
    const appleSignInEnabled = optionalBoolean(source, 'APPLE_SIGN_IN_ENABLED', failures);
    const appleClientId = appleSignInEnabled
        ? required(source, 'APPLE_CLIENT_ID', failures)
        : undefined;
    const appleKeyId = appleSignInEnabled ? required(source, 'APPLE_KEY_ID', failures) : undefined;
    const applePrivateKey = appleSignInEnabled
        ? required(source, 'APPLE_PRIVATE_KEY', failures)
        : undefined;
    const appleTeamId = appleSignInEnabled
        ? required(source, 'APPLE_TEAM_ID', failures)
        : undefined;
    const googleClientId = required(source, 'GOOGLE_CLIENT_ID', failures);
    const googleClientSecret = required(source, 'GOOGLE_CLIENT_SECRET', failures);

    if (apiHost && /\s/.test(apiHost)) {
        failures.push({ name: 'API_HOST', reason: 'must not contain whitespace' });
    }
    if (authSecret && authSecret.length < 32) {
        failures.push({ name: 'AUTH_SECRET', reason: 'must contain at least 32 characters' });
    }
    if (
        appleSignInEnabled &&
        (appEnvironment === 'uat' || appEnvironment === 'production') &&
        applePrivateKey
    ) {
        validateApplePrivateKey(applePrivateKey, failures);
    }
    if (failures.length > 0) {
        throw new EnvironmentValidationError(failures);
    }

    return {
        ...workerEnvironment,
        apiHost,
        apiPort,
        auth: {
            baseUrl: authBaseUrl,
            secret: authSecret,
            googleClientId,
            googleClientSecret,
            secureCookies: appEnvironment === 'uat' || appEnvironment === 'production',
            ...(appleSignInEnabled
                ? {
                      appleSignInEnabled: true as const,
                      appleClientId: appleClientId ?? '',
                      appleKeyId: appleKeyId ?? '',
                      applePrivateKey: applePrivateKey ?? '',
                      appleTeamId: appleTeamId ?? '',
                  }
                : { appleSignInEnabled: false as const }),
        },
    };
}

export function loadRepositoryEnvironmentFile(source: EnvironmentSource = process.env): void {
    const configuredPath = source.PICKFLICK_ENV_FILE?.trim();
    const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
    // resolve() keeps an absolute path as given and anchors a relative one at the repository.
    const environmentPath = resolve(repositoryRoot, configuredPath || '.env');

    try {
        process.loadEnvFile(environmentPath);
    } catch (error) {
        const code = error instanceof Error && 'code' in error ? error.code : undefined;
        if (code === 'ENOENT' && !configuredPath) {
            return;
        }
        throw new EnvironmentValidationError([
            {
                name: 'PICKFLICK_ENV_FILE',
                reason: code === 'ENOENT' ? 'does not exist' : 'could not be loaded',
            },
        ]);
    }
}

export function loadDatabaseEnvironment(): DatabaseEnvironment {
    loadRepositoryEnvironmentFile();
    return parseDatabaseEnvironment(process.env);
}

export function loadRuntimeEnvironment(): RuntimeEnvironment {
    loadRepositoryEnvironmentFile();
    return parseRuntimeEnvironment(process.env);
}

export function loadWorkerEnvironment(): WorkerEnvironment {
    loadRepositoryEnvironmentFile();
    return parseWorkerEnvironment(process.env);
}
