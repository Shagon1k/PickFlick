import { createPrivateKey } from 'node:crypto';

import { z } from 'zod';

import { redisUrl } from './notification-environment.schema.js';

export const APP_ENVIRONMENTS = ['local', 'test', 'uat', 'production'] as const;

const PRODUCTION_SENDER = 'PickFlick <notifications@pick-flick.app>';
const UAT_SENDER = 'PickFlick UAT <notifications@uat.pick-flick.app>';
const PRODUCTION_CONTACT = 'hello@pick-flick.app';

const required = z.string().trim().min(1, 'is required');
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');
const optionalFlag = z.preprocess((value) => (value === '' ? undefined : value), flag.optional());

function createUrlSchema(check: (url: URL) => boolean, message: string) {
    return required.refine((value) => {
        try {
            return check(new URL(value));
        } catch {
            return false;
        }
    }, message);
}

const databaseUrl = createUrlSchema(
    (url) =>
        ['postgres:', 'postgresql:'].includes(url.protocol) &&
        Boolean(url.hostname) &&
        url.pathname.length > 1,
    'must be a postgres URL with a host and database name',
);
const httpUrl = createUrlSchema(
    (url) => ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname),
    'must be an http(s) URL',
);
const origin = createUrlSchema(
    (url) =>
        ['http:', 'https:'].includes(url.protocol) &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password,
    'must be an origin without credentials, path, query, or fragment',
).transform((value) => new URL(value).origin);

const email = z.email('must be an email address');
// `name@domain.tld` or `Display Name <name@domain.tld>`.
const mailbox = required.refine((value) => {
    const match = /^(?:[^<>@\r\n]+ <)?([^<>\s]+)>?$/u.exec(value);
    return Boolean(
        match?.[1] &&
        email.safeParse(match[1]).success &&
        value.endsWith('>') === value.includes('<'),
    );
}, 'must be an email address or a name plus email address');

const bucket = required.refine(
    (value) =>
        /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(value) &&
        !value.includes('..') &&
        !/^(\d{1,3}\.){3}\d{1,3}$/u.test(value),
    'must be a valid lowercase S3 bucket name',
);

function isEcP256PrivateKey(pem: string): boolean {
    const normalized = pem.replaceAll('\\n', '\n');
    if (!normalized.startsWith('-----BEGIN PRIVATE KEY-----')) {
        return false;
    }
    try {
        const key = createPrivateKey(normalized);
        return (
            key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1'
        );
    } catch {
        return false;
    }
}

export const databaseEnvironmentSchema = z
    .object({ APP_ENV: z.enum(APP_ENVIRONMENTS), DATABASE_URL: databaseUrl })
    .transform((env) => ({ appEnvironment: env.APP_ENV, databaseUrl: env.DATABASE_URL }));

const movieCredential = z.string().trim().max(8192).regex(/^\S*$/u).optional();

const rawRuntimeEnvironmentSchema = z.object({
    APP_ENV: z.enum(APP_ENVIRONMENTS),
    SOURCE_REVISION: z
        .string()
        .trim()
        .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu, 'must be a full hexadecimal source revision')
        .optional()
        .or(z.literal('').transform(() => undefined)),
    BACKEND_HOST: required.regex(/^\S+$/u, 'must not contain whitespace'),
    BACKEND_PORT: z.coerce.number().int().min(1).max(65_535),
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    STORAGE_ENDPOINT: httpUrl,
    STORAGE_REGION: required,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY: required,
    STORAGE_SECRET_KEY: required,
    STORAGE_FORCE_PATH_STYLE: flag,
    RESEND_DELIVERY_MODE: z.enum(['disabled', 'preview', 'live']),
    RESEND_API_KEY: required,
    RESEND_FROM: mailbox,
    CONTACT_DELIVERY_TO: email,
    AUTH_BASE_URL: origin,
    AUTH_SECRET: required.min(32, 'must contain at least 32 characters'),
    GOOGLE_CLIENT_ID: required,
    GOOGLE_CLIENT_SECRET: required,
    CATALOG_PROVIDER: z.enum(['tmdb', 'poiskkino-thetvdb']).default('poiskkino-thetvdb'),
    CATALOG_LOCALE: z.literal('en-US').default('en-US'),
    CATALOG_ENABLED: flag.default(false),
    CATALOG_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
    POISKKINO_API_KEY: movieCredential,
    THETVDB_READ_TOKEN: movieCredential,
    TMDB_READ_TOKEN: movieCredential,
    CATALOG_REFRESH_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    CATALOG_STALE_HOURS: z.coerce.number().int().min(1).max(2160).default(168),
    APPLE_SIGN_IN_ENABLED: optionalFlag,
    APPLE_CLIENT_ID: z.string().trim().optional(),
    APPLE_KEY_ID: z.string().trim().optional(),
    APPLE_PRIVATE_KEY: z.string().trim().optional(),
    APPLE_TEAM_ID: z.string().trim().optional(),
});

type TRawRuntimeEnvironment = z.infer<typeof rawRuntimeEnvironmentSchema>;

const isDeployed = (env: TRawRuntimeEnvironment): boolean =>
    env.APP_ENV === 'uat' || env.APP_ENV === 'production';

const APPLE_CREDENTIALS = [
    'APPLE_CLIENT_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
    'APPLE_TEAM_ID',
] as const;

/** Cross-variable rules: when `broken` holds, `variable` fails with `message`. */
const RUNTIME_ENVIRONMENT_RULES: {
    variable: keyof TRawRuntimeEnvironment;
    message: string;
    broken: (env: TRawRuntimeEnvironment) => boolean;
}[] = [
    {
        variable: 'TMDB_READ_TOKEN',
        message: 'is required when TMDB is enabled',
        broken: (env) =>
            env.CATALOG_ENABLED && env.CATALOG_PROVIDER === 'tmdb' && !env.TMDB_READ_TOKEN,
    },
    {
        variable: 'CATALOG_STALE_HOURS',
        message: 'must be at least CATALOG_REFRESH_HOURS',
        broken: (env) => env.CATALOG_STALE_HOURS < env.CATALOG_REFRESH_HOURS,
    },
    {
        variable: 'POISKKINO_API_KEY',
        message: 'is required when PoiskKino is enabled',
        broken: (env) =>
            env.CATALOG_ENABLED &&
            env.CATALOG_PROVIDER === 'poiskkino-thetvdb' &&
            !env.POISKKINO_API_KEY,
    },
    {
        variable: 'THETVDB_READ_TOKEN',
        message: 'is required when TheTVDB is enabled',
        broken: (env) =>
            env.CATALOG_ENABLED &&
            env.CATALOG_PROVIDER === 'poiskkino-thetvdb' &&
            !env.THETVDB_READ_TOKEN,
    },
    // Email: local and test never send, UAT may preview, production always delivers live.
    {
        variable: 'RESEND_DELIVERY_MODE',
        message: 'must be disabled in local or test',
        broken: (env) => !isDeployed(env) && env.RESEND_DELIVERY_MODE !== 'disabled',
    },
    {
        variable: 'RESEND_API_KEY',
        message: 'must be local-disabled in local or test',
        broken: (env) => !isDeployed(env) && env.RESEND_API_KEY !== 'local-disabled',
    },
    {
        variable: 'RESEND_DELIVERY_MODE',
        message: 'may be disabled only in local or test',
        broken: (env) => isDeployed(env) && env.RESEND_DELIVERY_MODE === 'disabled',
    },
    {
        variable: 'RESEND_DELIVERY_MODE',
        message: 'may be preview only in uat',
        broken: (env) => env.RESEND_DELIVERY_MODE === 'preview' && env.APP_ENV !== 'uat',
    },
    {
        variable: 'RESEND_API_KEY',
        message: 'must be preview-disabled in preview mode',
        broken: (env) =>
            env.RESEND_DELIVERY_MODE === 'preview' && env.RESEND_API_KEY !== 'preview-disabled',
    },
    {
        variable: 'RESEND_API_KEY',
        message: 'must be a live environment key in live mode',
        broken: (env) =>
            env.RESEND_DELIVERY_MODE === 'live' &&
            ['local-disabled', 'preview-disabled'].includes(env.RESEND_API_KEY),
    },
    {
        variable: 'RESEND_DELIVERY_MODE',
        message: 'must be live in production',
        broken: (env) => env.APP_ENV === 'production' && env.RESEND_DELIVERY_MODE !== 'live',
    },
    {
        variable: 'RESEND_FROM',
        message: `must be ${UAT_SENDER} in uat`,
        broken: (env) => env.APP_ENV === 'uat' && env.RESEND_FROM !== UAT_SENDER,
    },
    {
        variable: 'RESEND_FROM',
        message: `must be ${PRODUCTION_SENDER} in production`,
        broken: (env) => env.APP_ENV === 'production' && env.RESEND_FROM !== PRODUCTION_SENDER,
    },
    {
        variable: 'CONTACT_DELIVERY_TO',
        message: `must be ${PRODUCTION_CONTACT} in production`,
        broken: (env) =>
            env.APP_ENV === 'production' && env.CONTACT_DELIVERY_TO !== PRODUCTION_CONTACT,
    },
    {
        variable: 'AUTH_BASE_URL',
        message: 'must use https in uat or production',
        broken: (env) => isDeployed(env) && !env.AUTH_BASE_URL.startsWith('https:'),
    },
    ...APPLE_CREDENTIALS.map((variable) => ({
        variable,
        message: 'is required',
        broken: (env: TRawRuntimeEnvironment) =>
            Boolean(env.APPLE_SIGN_IN_ENABLED) && !env[variable],
    })),
    {
        variable: 'APPLE_PRIVATE_KEY',
        // The API signs Apple's client secret at startup, so a bad key must fail validation first.
        message: 'must be a valid EC P-256 PKCS#8 PEM private key',
        broken: (env) =>
            Boolean(env.APPLE_SIGN_IN_ENABLED) &&
            Boolean(env.APPLE_PRIVATE_KEY) &&
            !isEcP256PrivateKey(env.APPLE_PRIVATE_KEY ?? ''),
    },
];

export const runtimeEnvironmentSchema = rawRuntimeEnvironmentSchema
    .superRefine((env, context) => {
        for (const rule of RUNTIME_ENVIRONMENT_RULES) {
            if (rule.broken(env)) {
                context.addIssue({ code: 'custom', path: [rule.variable], message: rule.message });
            }
        }
    })
    .transform((env) => ({
        appEnvironment: env.APP_ENV,
        sourceRevision: env.SOURCE_REVISION,
        backendHost: env.BACKEND_HOST,
        backendPort: env.BACKEND_PORT,
        databaseUrl: env.DATABASE_URL,
        redisUrl: env.REDIS_URL,
        storage: {
            endpoint: env.STORAGE_ENDPOINT,
            region: env.STORAGE_REGION,
            bucket: env.STORAGE_BUCKET,
            accessKey: env.STORAGE_ACCESS_KEY,
            secretKey: env.STORAGE_SECRET_KEY,
            forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
        },
        resend: {
            apiKey: env.RESEND_API_KEY,
            from: env.RESEND_FROM,
            deliveryMode: env.RESEND_DELIVERY_MODE,
            deliveryEnabled: env.RESEND_DELIVERY_MODE === 'live',
        },
        contact: { deliveryTo: env.CONTACT_DELIVERY_TO },
        catalog: {
            provider: env.CATALOG_PROVIDER,
            locale: env.CATALOG_LOCALE,
            refreshHours: env.CATALOG_REFRESH_HOURS,
            staleHours: env.CATALOG_STALE_HOURS,
        },
        poiskkino: {
            enabled: env.CATALOG_ENABLED && env.CATALOG_PROVIDER === 'poiskkino-thetvdb',
            apiKey: env.POISKKINO_API_KEY,
            timeoutMs: env.CATALOG_TIMEOUT_MS,
        },
        thetvdb: {
            enabled: env.CATALOG_ENABLED && env.CATALOG_PROVIDER === 'poiskkino-thetvdb',
            readToken: env.THETVDB_READ_TOKEN,
            timeoutMs: env.CATALOG_TIMEOUT_MS,
        },
        tmdb: {
            enabled: env.CATALOG_ENABLED && env.CATALOG_PROVIDER === 'tmdb',
            readToken: env.TMDB_READ_TOKEN,
            timeoutMs: env.CATALOG_TIMEOUT_MS,
        },
        auth: {
            baseUrl: env.AUTH_BASE_URL,
            secret: env.AUTH_SECRET,
            googleClientId: env.GOOGLE_CLIENT_ID,
            googleClientSecret: env.GOOGLE_CLIENT_SECRET,
            secureCookies: env.APP_ENV === 'uat' || env.APP_ENV === 'production',
            ...(env.APPLE_SIGN_IN_ENABLED
                ? {
                      appleSignInEnabled: true as const,
                      appleClientId: env.APPLE_CLIENT_ID ?? '',
                      appleKeyId: env.APPLE_KEY_ID ?? '',
                      applePrivateKey: env.APPLE_PRIVATE_KEY ?? '',
                      appleTeamId: env.APPLE_TEAM_ID ?? '',
                  }
                : { appleSignInEnabled: false as const }),
        },
    }));

export type TDatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type TRuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;
