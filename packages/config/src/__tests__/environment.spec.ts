import { generateKeyPairSync } from 'node:crypto';

import {
    EnvironmentValidationError,
    getSafeEnvironmentValidationFailures,
    parseDatabaseEnvironment,
    parseRuntimeEnvironment,
} from '../environment.js';

const local = {
    APP_ENV: 'local',
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: '3001',
    REDIS_URL: 'redis://127.0.0.1:16379',
    DATABASE_URL: 'postgresql://pickflick:secret@127.0.0.1:15432/pickflick_local',
    STORAGE_ENDPOINT: 'http://127.0.0.1:19000',
    STORAGE_REGION: 'us-east-1',
    STORAGE_BUCKET: 'pickflick-local',
    STORAGE_ACCESS_KEY: 'access',
    STORAGE_SECRET_KEY: 'secret',
    STORAGE_FORCE_PATH_STYLE: 'true',
    RESEND_DELIVERY_MODE: 'disabled',
    RESEND_API_KEY: 'local-disabled',
    RESEND_FROM: 'PickFlick Local <notifications@example.invalid>',
    CONTACT_DELIVERY_TO: 'contact@example.invalid',
    AUTH_BASE_URL: 'http://127.0.0.1:3000',
    AUTH_SECRET: 'a-local-secret-that-is-at-least-32-characters',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
};

const production = {
    ...local,
    APP_ENV: 'production',
    RESEND_DELIVERY_MODE: 'live',
    RESEND_API_KEY: 're_live_key',
    RESEND_WEBHOOK_SECRET: 'synthetic-provider-signing-secret',
    RESEND_FROM: 'PickFlick <notifications@pick-flick.app>',
    CONTACT_DELIVERY_TO: 'hello@pick-flick.app',
    AUTH_BASE_URL: 'https://pick-flick.app',
};

function failuresOf(source: Record<string, string>): string[] {
    try {
        parseRuntimeEnvironment(source);
    } catch (error) {
        return getSafeEnvironmentValidationFailures(error) ?? [];
    }
    return [];
}

describe('parseRuntimeEnvironment', () => {
    it('should validate the notification Redis URL without exposing its value', () => {
        expect(parseRuntimeEnvironment(local).redisUrl).toBe('redis://127.0.0.1:16379');
        expect(
            parseRuntimeEnvironment({ ...local, REDIS_URL: 'rediss://broker.invalid:6379' })
                .redisUrl,
        ).toBe('rediss://broker.invalid:6379');
        for (const value of ['', 'https://broker.invalid', 'redis:///']) {
            expect(failuresOf({ ...local, REDIS_URL: value })).toEqual([
                'REDIS_URL must be a redis(s) URL with a host',
            ]);
        }
    });

    it('should build the typed runtime environment', () => {
        expect(parseRuntimeEnvironment(local)).toMatchObject({
            appEnvironment: 'local',
            backendPort: 3001,
            storage: { forcePathStyle: true, bucket: 'pickflick-local' },
            resend: { deliveryEnabled: false },
            auth: {
                baseUrl: 'http://127.0.0.1:3000',
                secureCookies: false,
                appleSignInEnabled: false,
            },
        });
    });

    it('should accept production with live delivery and secure cookies', () => {
        expect(parseRuntimeEnvironment(production)).toMatchObject({
            resend: { deliveryEnabled: true },
            auth: { secureCookies: true },
        });
    });

    describe('when using the UAT sender alias', () => {
        const uat = {
            ...local,
            APP_ENV: 'uat',
            AUTH_BASE_URL: 'https://uat.pick-flick.app',
            RESEND_FROM: 'PickFlick UAT <uat@pick-flick.app>',
            CONTACT_DELIVERY_TO: 'test@pick-flick.app',
        };

        it.each([
            { mode: 'preview', apiKey: 'preview-disabled', isEnabled: false },
            { mode: 'live', apiKey: 'synthetic-uat-sending-key', isEnabled: true },
        ])(
            'should accept $mode delivery with the approved alias',
            ({ mode, apiKey, isEnabled }) => {
                expect(
                    parseRuntimeEnvironment({
                        ...uat,
                        RESEND_DELIVERY_MODE: mode,
                        RESEND_API_KEY: apiKey,
                        RESEND_WEBHOOK_SECRET: 'synthetic-provider-signing-secret',
                    }).resend,
                ).toMatchObject({
                    from: 'PickFlick UAT <uat@pick-flick.app>',
                    deliveryEnabled: isEnabled,
                });
            },
        );

        it.each([
            'PickFlick UAT <notifications@uat.pick-flick.app>',
            'PickFlick <notifications@pick-flick.app>',
        ])('should reject a different UAT identity: %s', (sender) => {
            expect(
                failuresOf({
                    ...uat,
                    RESEND_DELIVERY_MODE: 'preview',
                    RESEND_API_KEY: 'preview-disabled',
                    RESEND_FROM: sender,
                }),
            ).toContain('RESEND_FROM must be PickFlick UAT <uat@pick-flick.app> in uat');
        });
    });

    it('should require a webhook signing secret only for live delivery', () => {
        expect(failuresOf({ ...production, RESEND_WEBHOOK_SECRET: '' })).toContain(
            'RESEND_WEBHOOK_SECRET is required in live mode',
        );
        expect(parseRuntimeEnvironment(local).resend.webhookSecret).toBe('');
    });

    it('should name every missing variable without echoing values', () => {
        const failures = failuresOf({ APP_ENV: 'local', AUTH_SECRET: 'short-secret-value' });

        expect(failures).toContain('DATABASE_URL is required');
        expect(failures).toContain('AUTH_SECRET must contain at least 32 characters');
        expect(failures.join(' ')).not.toContain('short-secret-value');
    });

    it('should keep TMDB disabled by default and validate enabled configuration safely', () => {
        expect(parseRuntimeEnvironment(local).tmdb).toMatchObject({
            enabled: false,
            timeoutMs: 5000,
        });
        expect(
            failuresOf({ ...local, CATALOG_ENABLED: 'true', CATALOG_PROVIDER: 'tmdb' }),
        ).toContain('TMDB_READ_TOKEN is required when TMDB is enabled');
        expect(
            failuresOf({ ...local, CATALOG_REFRESH_HOURS: '200', CATALOG_STALE_HOURS: '168' }),
        ).toContain('CATALOG_STALE_HOURS must be at least CATALOG_REFRESH_HOURS');
        expect(failuresOf({ ...local, CATALOG_TIMEOUT_MS: '0' }).join(' ')).toContain(
            'CATALOG_TIMEOUT_MS',
        );
    });

    it('should share the gate and timeout while requiring only selected credentials', () => {
        const environment = parseRuntimeEnvironment({
            ...local,
            CATALOG_PROVIDER: 'tmdb',
            CATALOG_ENABLED: 'true',
            CATALOG_TIMEOUT_MS: '1200',
            TMDB_READ_TOKEN: 'synthetic-only',
        });
        expect(environment.tmdb).toMatchObject({ enabled: true, timeoutMs: 1200 });
        expect(environment.poiskkino).toMatchObject({ enabled: false, timeoutMs: 1200 });
        expect(environment.thetvdb).toMatchObject({ enabled: false, timeoutMs: 1200 });
        expect(
            failuresOf({
                ...local,
                CATALOG_ENABLED: 'true',
                POISKKINO_API_KEY: 'synthetic-only',
                THETVDB_READ_TOKEN: 'synthetic-only',
            }),
        ).toEqual([]);
    });

    it.each([
        [
            { ...local, RESEND_DELIVERY_MODE: 'live' },
            'RESEND_DELIVERY_MODE must be disabled in local or test',
        ],
        [
            { ...production, RESEND_DELIVERY_MODE: 'preview' },
            'RESEND_DELIVERY_MODE may be preview only in uat',
        ],
        [{ ...production, RESEND_FROM: 'Other <a@b.example>' }, 'RESEND_FROM must be PickFlick'],
        [
            { ...production, RESEND_FROM: 'PickFlick UAT <uat@pick-flick.app>' },
            'RESEND_FROM must be PickFlick <notifications@pick-flick.app> in production',
        ],
        [
            { ...production, CONTACT_DELIVERY_TO: 'me@b.example' },
            'CONTACT_DELIVERY_TO must be hello@pick-flick.app',
        ],
        [{ ...production, AUTH_BASE_URL: 'http://pick-flick.app' }, 'AUTH_BASE_URL must use https'],
        [
            { ...local, AUTH_BASE_URL: 'http://127.0.0.1:3000/path' },
            'AUTH_BASE_URL must be an origin',
        ],
        [
            { ...local, DATABASE_URL: 'postgresql://127.0.0.1:5432' },
            'DATABASE_URL must be a postgres URL',
        ],
        [
            { ...local, STORAGE_BUCKET: '192.168.5.4' },
            'STORAGE_BUCKET must be a valid lowercase S3 bucket name',
        ],
        [
            { ...local, SOURCE_REVISION: 'abc' },
            'SOURCE_REVISION must be a full hexadecimal source revision',
        ],
    ])('should reject case %#', (source, failure) => {
        expect(failuresOf(source).join(' ')).toContain(failure);
    });

    describe('when Apple Sign In is enabled', () => {
        const apple = {
            APPLE_SIGN_IN_ENABLED: 'true',
            APPLE_CLIENT_ID: 'client',
            APPLE_KEY_ID: 'key',
            APPLE_TEAM_ID: 'team',
        };

        it('should require every Apple credential', () => {
            expect(failuresOf({ ...local, APPLE_SIGN_IN_ENABLED: 'true' })).toEqual(
                expect.arrayContaining([
                    'APPLE_CLIENT_ID is required',
                    'APPLE_PRIVATE_KEY is required',
                ]),
            );
        });

        it('should require a real EC P-256 key', () => {
            const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
                .privateKey.export({ format: 'pem', type: 'pkcs8' })
                .toString();

            expect(
                failuresOf({ ...local, ...apple, APPLE_PRIVATE_KEY: 'not-a-key' }).join(' '),
            ).toContain('APPLE_PRIVATE_KEY must be a valid EC P-256');
            expect(
                parseRuntimeEnvironment({ ...production, ...apple, APPLE_PRIVATE_KEY: key }).auth,
            ).toMatchObject({ appleSignInEnabled: true });
        });
    });
});

describe('parseDatabaseEnvironment', () => {
    it('should need only the environment name and database URL', () => {
        expect(
            parseDatabaseEnvironment({ APP_ENV: 'test', DATABASE_URL: local.DATABASE_URL }),
        ).toEqual({
            appEnvironment: 'test',
            databaseUrl: local.DATABASE_URL,
        });
    });

    it('should throw an EnvironmentValidationError', () => {
        expect(() => parseDatabaseEnvironment({ APP_ENV: 'staging' })).toThrow(
            EnvironmentValidationError,
        );
    });
    it('should validate source-specific credentials and shared catalog policy', () => {
        expect(parseRuntimeEnvironment(local).catalog).toEqual({
            provider: 'poiskkino-thetvdb',
            locale: 'en-US',
            refreshHours: 24,
            staleHours: 168,
        });
        expect(
            parseRuntimeEnvironment({ ...local, CATALOG_PROVIDER: 'tmdb' }).catalog.provider,
        ).toBe('tmdb');
        expect(failuresOf({ ...local, CATALOG_ENABLED: 'true' })).toContain(
            'POISKKINO_API_KEY is required when PoiskKino is enabled',
        );
        expect(failuresOf({ ...local, CATALOG_ENABLED: 'true' })).toContain(
            'THETVDB_READ_TOKEN is required when TheTVDB is enabled',
        );
        expect(failuresOf({ ...local, CATALOG_LOCALE: 'ru-RU' }).join(' ')).toContain(
            'CATALOG_LOCALE',
        );
    });
});
