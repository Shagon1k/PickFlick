import { createPrivateKey } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOYMENT_ENVIRONMENTS = ['local', 'test', 'uat', 'production'] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];
export const RESEND_DELIVERY_MODES = ['disabled', 'preview', 'live'] as const;
export type ResendDeliveryMode = (typeof RESEND_DELIVERY_MODES)[number];

export interface RuntimeEnvironment {
    readonly appEnvironment: DeploymentEnvironment;
    readonly sourceRevision?: string;
    readonly apiHost: string;
    readonly apiPort: number;
    readonly shutdownTimeoutMilliseconds: number;
    readonly databaseUrl: string;
    readonly redisUrl: string;
    readonly storage: {
        readonly endpoint: string;
        readonly region: string;
        readonly bucket: string;
        readonly accessKey: string;
        readonly secretKey: string;
        readonly forcePathStyle: boolean;
    };
    readonly resend: {
        readonly apiKey: string;
        readonly from: string;
        readonly deliveryMode: ResendDeliveryMode;
        readonly deliveryEnabled: boolean;
    };
    readonly contact: {
        readonly deliveryTo: string;
        readonly hashSecret: string;
    };
    readonly auth: {
        readonly baseUrl: string;
        readonly secret: string;
        readonly googleClientId: string;
        readonly googleClientSecret: string;
        readonly secureCookies: boolean;
    } & (
        | {
              readonly appleSignInEnabled: true;
              readonly appleClientId: string;
              readonly appleKeyId: string;
              readonly applePrivateKey: string;
              readonly appleTeamId: string;
          }
        | {
              readonly appleSignInEnabled: false;
              readonly appleClientId?: string;
              readonly appleKeyId?: string;
              readonly applePrivateKey?: string;
              readonly appleTeamId?: string;
          }
    );
}

export type WorkerEnvironment = Omit<RuntimeEnvironment, 'apiHost' | 'apiPort' | 'auth'>;

export interface DatabaseEnvironment {
    readonly appEnvironment: DeploymentEnvironment;
    readonly databaseUrl: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

interface ValidationFailure {
    readonly name: string;
    readonly reason: string;
}

export class EnvironmentValidationError extends Error {
    readonly failures: readonly ValidationFailure[];

    constructor(failures: readonly ValidationFailure[]) {
        super(
            `Invalid environment configuration: ${failures.map(({ name, reason }) => name + ' ' + reason).join('; ')}`,
        );
        this.name = 'EnvironmentValidationError';
        this.failures = failures;
    }
}

/**
 * Produces diagnostic-safe validation details: names and fixed validation rules only.
 * Environment values, URLs, tokens, and other supplied data are never included.
 */
export function safeEnvironmentValidationFailures(error: unknown): readonly string[] | undefined {
    if (!(error instanceof EnvironmentValidationError)) {
        return undefined;
    }
    return error.failures.map(({ name, reason }) => `${name} ${reason}`);
}

// Domain labels exclude dots, so matching stays linear instead of backtracking over the domain.
const emailAddressPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

function isEmailAddress(value: string): boolean {
    return emailAddressPattern.test(value);
}

/** `local@domain.tld` or `Display Name <local@domain.tld>`. */
function isMailbox(value: string): boolean {
    if (isEmailAddress(value)) {
        return true;
    }
    const open = value.lastIndexOf(' <');
    return (
        open > 0 &&
        value.endsWith('>') &&
        !/[@<>\r\n]/u.test(value.slice(0, open)) &&
        isEmailAddress(value.slice(open + 2, -1))
    );
}

function required(source: EnvironmentSource, name: string, failures: ValidationFailure[]): string {
    const value = source[name]?.trim();
    if (!value) {
        failures.push({ name, reason: 'is required' });
        return '';
    }
    return value;
}

function oneOf<T extends readonly string[]>(
    source: EnvironmentSource,
    name: string,
    values: T,
    failures: ValidationFailure[],
): T[number] {
    const value = required(source, name, failures);
    if (value && !values.includes(value)) {
        failures.push({ name, reason: `must be one of ${values.join(', ')}` });
    }
    return value as T[number];
}

function integer(source: EnvironmentSource, name: string, failures: ValidationFailure[]): number {
    const value = required(source, name, failures);
    const parsed = Number(value);
    if (value && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535)) {
        failures.push({ name, reason: 'must be an integer from 1 through 65535' });
    }
    return parsed;
}

function durationMilliseconds(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): number {
    const value = required(source, name, failures);
    const parsed = Number(value);
    if (value && (!Number.isInteger(parsed) || parsed < 1 || parsed > 86_400_000)) {
        failures.push({ name, reason: 'must be an integer from 1 through 86400000' });
    }
    return parsed;
}

function boolean(source: EnvironmentSource, name: string, failures: ValidationFailure[]): boolean {
    const value = required(source, name, failures);
    if (value && value !== 'true' && value !== 'false') {
        failures.push({ name, reason: 'must be true or false' });
    }
    return value === 'true';
}

function optionalBoolean(
    source: EnvironmentSource,
    name: string,
    failures: ValidationFailure[],
): boolean {
    const value = source[name]?.trim();
    if (!value) {
        return false;
    }
    if (value !== 'true' && value !== 'false') {
        failures.push({ name, reason: 'must be true or false' });
    }
    return value === 'true';
}

function url(
    source: EnvironmentSource,
    name: string,
    protocols: readonly string[],
    failures: ValidationFailure[],
    structure?: 'host' | 'host-and-path',
): string {
    const value = required(source, name, failures);
    if (!value) {
        return value;
    }
    try {
        const parsed = new URL(value);
        if (!protocols.includes(parsed.protocol)) {
            failures.push({ name, reason: `must use ${protocols.join(' or ')}` });
        }
        if (structure && !parsed.hostname) {
            failures.push({ name, reason: 'must include a host' });
        }
        if (structure === 'host-and-path' && (!parsed.pathname || parsed.pathname === '/')) {
            failures.push({ name, reason: 'must include a database name' });
        }
    } catch {
        failures.push({ name, reason: 'must be a valid URL' });
    }
    return value;
}

function originUrl(
    source: EnvironmentSource,
    name: string,
    appEnvironment: DeploymentEnvironment,
    failures: ValidationFailure[],
): string {
    const value = url(source, name, ['http:', 'https:'], failures, 'host');
    if (!value) {
        return value;
    }
    try {
        const parsed = new URL(value);
        if (
            parsed.pathname !== '/' ||
            parsed.search ||
            parsed.hash ||
            parsed.username ||
            parsed.password
        ) {
            failures.push({
                name,
                reason: 'must be an origin without credentials, path, query, or fragment',
            });
        }
        if (
            (appEnvironment === 'uat' || appEnvironment === 'production') &&
            parsed.protocol !== 'https:'
        ) {
            failures.push({ name, reason: 'must use https in uat or production' });
        }
        return parsed.origin;
    } catch {
        return value;
    }
}

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

function validateStorageBucket(bucket: string, failures: ValidationFailure[]): void {
    if (
        bucket &&
        (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
            bucket.includes('..') ||
            /^(?:\d{1,3}\.){3}\d{1,3}$/.test(bucket))
    ) {
        failures.push({
            name: 'STORAGE_BUCKET',
            reason: 'must be a valid lowercase S3 bucket name',
        });
    }
}

function validateContactMailboxes(
    appEnvironment: DeploymentEnvironment,
    from: string,
    contactDeliveryTo: string,
    failures: ValidationFailure[],
): void {
    if (from && !isMailbox(from)) {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be an email address or a name plus email address',
        });
    }
    if (appEnvironment === 'uat' && from !== 'PickFlick UAT <notifications@uat.pick-flick.app>') {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be PickFlick UAT <notifications@uat.pick-flick.app> in uat',
        });
    }
    if (appEnvironment === 'production' && from !== 'PickFlick <notifications@pick-flick.app>') {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be PickFlick <notifications@pick-flick.app> in production',
        });
    }
    if (contactDeliveryTo && !isEmailAddress(contactDeliveryTo)) {
        failures.push({ name: 'CONTACT_DELIVERY_TO', reason: 'must be an email address' });
    }
    if (appEnvironment === 'production' && contactDeliveryTo !== 'hello@pick-flick.app') {
        failures.push({
            name: 'CONTACT_DELIVERY_TO',
            reason: 'must be hello@pick-flick.app in production',
        });
    }
}

/** Local and test never send, UAT may preview, and production always delivers live. */
function validateResendDelivery(
    appEnvironment: DeploymentEnvironment,
    resendDeliveryMode: ResendDeliveryMode,
    resendApiKey: string,
    failures: ValidationFailure[],
): void {
    const localOrTest = appEnvironment === 'local' || appEnvironment === 'test';
    if (localOrTest && resendDeliveryMode !== 'disabled') {
        failures.push({
            name: 'RESEND_DELIVERY_MODE',
            reason: 'must be disabled in local or test',
        });
    }
    if (localOrTest && resendApiKey !== 'local-disabled') {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be local-disabled in local or test',
        });
    }
    if (resendDeliveryMode === 'disabled' && !localOrTest) {
        failures.push({
            name: 'RESEND_DELIVERY_MODE',
            reason: 'may be disabled only in local or test',
        });
    }
    if (resendDeliveryMode === 'preview' && appEnvironment !== 'uat') {
        failures.push({ name: 'RESEND_DELIVERY_MODE', reason: 'may be preview only in uat' });
    }
    if (resendDeliveryMode === 'preview' && resendApiKey !== 'preview-disabled') {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be preview-disabled in preview mode',
        });
    }
    if (
        resendDeliveryMode === 'live' &&
        (resendApiKey === 'local-disabled' || resendApiKey === 'preview-disabled')
    ) {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be a live environment key in live mode',
        });
    }
    if (appEnvironment === 'production' && resendDeliveryMode !== 'live') {
        failures.push({ name: 'RESEND_DELIVERY_MODE', reason: 'must be live in production' });
    }
}

function validateApplePrivateKey(applePrivateKey: string, failures: ValidationFailure[]): void {
    try {
        const normalizedPrivateKey = applePrivateKey.replaceAll('\\n', '\n');
        if (!normalizedPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            throw new Error('Not PKCS#8 PEM.');
        }
        const privateKey = createPrivateKey(normalizedPrivateKey);
        if (
            privateKey.asymmetricKeyType !== 'ec' ||
            privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
        ) {
            throw new Error('Not an EC P-256 key.');
        }
    } catch {
        failures.push({
            name: 'APPLE_PRIVATE_KEY',
            reason: 'must be a valid EC P-256 PKCS#8 PEM private key in uat or production',
        });
    }
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
