import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const applicationServices = ['api', 'release', 'web', 'worker'];
const deploymentSourceRevision = 'a'.repeat(40);
const runtimeServices = ['api', 'web', 'worker'];
const intendedHealthChecks = {
    api: [
        'CMD',
        'node',
        '-e',
        "fetch('http://127.0.0.1:3001/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
    ],
    web: [
        'CMD',
        'node',
        '-e',
        "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
    ],
};
const runtimeEnvironmentVariables = [
    'APP_ENV',
    'RESEND_DELIVERY_MODE',
    'CONTACT_DELIVERY_TO',
    'CONTACT_HASH_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'RESEND_API_KEY',
    'RESEND_FROM',
    'SHUTDOWN_TIMEOUT_MS',

    'STORAGE_ACCESS_KEY',
    'STORAGE_BUCKET',
    'STORAGE_ENDPOINT',
    'STORAGE_FORCE_PATH_STYLE',
    'STORAGE_REGION',
    'STORAGE_SECRET_KEY',
];
const authenticationEnvironmentVariables = [
    'AUTH_BASE_URL',
    'AUTH_SECRET',
    'APPLE_SIGN_IN_ENABLED',
    'APPLE_CLIENT_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
    'APPLE_TEAM_ID',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
];
const requiredAuthenticationEnvironmentVariables = [
    'AUTH_BASE_URL',
    'AUTH_SECRET',
    'APPLE_SIGN_IN_ENABLED',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
];
const previewAuthenticationEnvironment = {
    AUTH_BASE_URL: 'https://preview-3.shagon1k.win',
    AUTH_SECRET: 'synthetic-preview-auth-secret-at-least-32-characters',
    APPLE_SIGN_IN_ENABLED: 'false',
    GOOGLE_CLIENT_ID: 'synthetic-preview-google-client-id',
    GOOGLE_CLIENT_SECRET: 'synthetic-preview-google-client-secret',
};
const apiEnvironmentVariables = [
    ...runtimeEnvironmentVariables,
    ...requiredAuthenticationEnvironmentVariables,
    'API_HOST',
    'API_PORT',
];

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function environmentFor(appEnvironment) {
    const environment = {
        APP_ENV: appEnvironment,
        RESEND_DELIVERY_MODE: 'live',
        CONTACT_DELIVERY_TO: 'contact@example.invalid',
        CONTACT_HASH_SECRET: 'synthetic-contact-hash-secret-at-least-32-characters',
        DATABASE_URL: `postgresql://pickflick:synthetic@pickflick-${appEnvironment}-postgres:5432/pickflick_${appEnvironment}`,

        REDIS_URL: `redis://:synthetic@pickflick-${appEnvironment}-redis:6379/0`,
        RESEND_API_KEY: 'synthetic-resend-key',
        RESEND_FROM: 'PickFlick <pickflick@example.invalid>',
        SHUTDOWN_TIMEOUT_MS: '10000',
        SOURCE_REVISION: deploymentSourceRevision,

        AUTH_BASE_URL:
            appEnvironment === 'uat' ? 'https://uat.pick-flick.app' : 'https://pick-flick.app',
        AUTH_SECRET: 'synthetic-auth-secret-at-least-32-characters',
        APPLE_SIGN_IN_ENABLED: 'false',
        GOOGLE_CLIENT_ID: 'synthetic-google-client-id',
        GOOGLE_CLIENT_SECRET: 'synthetic-google-client-secret',

        STORAGE_ACCESS_KEY: `pickflick-${appEnvironment}`,
        STORAGE_BUCKET: `pickflick-${appEnvironment}`,
        STORAGE_ENDPOINT: `https://objects-${appEnvironment}.example.invalid`,
        STORAGE_FORCE_PATH_STYLE: 'false',
        STORAGE_REGION: 'us-east-1',
        STORAGE_SECRET_KEY: 'synthetic-storage-secret',
    };

    return environment;
}

export function validatePreviewAuthContract(overrides = {}) {
    const result = spawnSync('docker', ['compose', '-f', 'compose.preview.yaml', 'config', '-q'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
            ...process.env,
            BACKEND_PORT: '13001',
            DATABASE_URL: 'postgresql://pickflick:synthetic@postgres:5432/pickflick',
            FRONTEND_PORT: '13000',
            MINIO_API_PORT: '19000',
            MINIO_CONSOLE_PORT: '19001',
            MINIO_ROOT_PASSWORD: 'synthetic-preview-minio-password',
            MINIO_ROOT_USER: 'synthetic-preview-minio-user',
            POSTGRES_PASSWORD: 'synthetic-preview-postgres-password',
            POSTGRES_PORT: '15432',
            REDIS_PORT: '16379',
            SOURCE_REVISION: deploymentSourceRevision,
            ...previewAuthenticationEnvironment,
            ...overrides,
        },
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Preview authentication Compose contract failed: ${result.stderr.trim()}`);
    }
}

export function renderDeployment(appEnvironment) {
    if (appEnvironment !== 'uat' && appEnvironment !== 'production') {
        throw new Error('Deployment Compose may only render for uat or production.');
    }
    const result = spawnSync(
        'docker',
        ['compose', '-f', 'compose.deploy.yaml', 'config', '--format', 'json'],
        {
            cwd: repositoryRoot,
            encoding: 'utf8',
            env: { ...process.env, ...environmentFor(appEnvironment) },
        },
    );
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Compose validation failed for ${appEnvironment}: ${result.stderr.trim()}`);
    }
    return JSON.parse(result.stdout);
}

function dependsOnCompletedRelease(service) {
    const release = service.depends_on?.release;
    return release?.condition === 'service_completed_successfully' && release.required === true;
}

function validateRequiredEnvironment(service, names, serviceName) {
    for (const name of names) {
        const value = service.environment?.[name];
        assert(
            value !== undefined && value !== null && value !== '',
            `${serviceName} must receive ${name}.`,
        );
    }
}

function hasEnabledHealthCheck(service) {
    const test = service.healthcheck?.test;
    return (
        service.healthcheck?.disable !== true &&
        Array.isArray(test) &&
        test.length > 1 &&
        (test[0] === 'CMD' || test[0] === 'CMD-SHELL')
    );
}

function hasIntendedHealthCheck(service, intendedTest) {
    const test = service.healthcheck?.test;
    return (
        Array.isArray(test) &&
        test.length === intendedTest.length &&
        test.every((part, index) => part === intendedTest[index])
    );
}

function hasUniqueAliasOwners(services) {
    const aliasOwners = new Map();

    for (const name of applicationServices) {
        for (const alias of new Set(services[name].networks.application.aliases)) {
            if (aliasOwners.has(alias)) {
                return false;
            }
            aliasOwners.set(alias, name);
        }
    }

    return true;
}

export function validateDeployments({ production, uat }) {
    for (const [appEnvironment, deployment] of Object.entries({ production, uat })) {
        assert(
            JSON.stringify(Object.keys(deployment.services).sort()) ===
                JSON.stringify(applicationServices),
            'Deployment Compose must contain only api, release, web, and worker.',
        );

        assert(
            deployment.name === `pickflick-${appEnvironment}`,
            `${appEnvironment} must use its own Compose project name.`,
        );

        for (const name of applicationServices) {
            const service = deployment.services[name];
            assert(service.ports === undefined, `${name} must not publish host ports.`);
            assert(service.read_only === true, `${name} must use a read-only root filesystem.`);
            assert(service.init === true, `${name} must use an init process.`);
            assert(service.cap_drop?.includes('ALL'), `${name} must drop Linux capabilities.`);
            assert(
                service.security_opt?.includes('no-new-privileges:true'),
                `${name} must prevent new privileges.`,
            );
            assert(service.tmpfs?.includes('/tmp'), `${name} must mount /tmp as tmpfs.`);
            assert(
                service.build?.args?.SOURCE_REVISION === deploymentSourceRevision,
                `${name} must receive the selected source revision as a build argument.`,
            );

            assert(
                service.networks?.application?.aliases?.includes(
                    `pickflick-${appEnvironment}-${name}`,
                ),
                `${name} must use its environment-specific service alias.`,
            );
        }

        assert(
            deployment.services.release.profiles === undefined,
            'The release gate must use native Compose ordering.',
        );
        assert(
            runtimeServices.every(
                (name) => !(name in (deployment.services.release.depends_on ?? {})),
            ),
            'The release gate must not depend on application services.',
        );
        assert(
            deployment.services.release.build?.target === 'release',
            'The release gate must build the release target.',
        );
        assert(
            deployment.services.release.command == null,
            'The release gate must use the image command.',
        );
        assert(
            deployment.services.release.entrypoint == null,
            'The release gate must use the image entrypoint.',
        );
        validateRequiredEnvironment(
            deployment.services.release,
            ['APP_ENV', 'DATABASE_URL'],
            'release',
        );

        for (const name of runtimeServices) {
            assert(
                deployment.services[name].profiles === undefined,
                `${name} must use native Compose ordering.`,
            );
            assert(
                deployment.services[name].build?.target === name,
                `${name} must build the ${name} target.`,
            );
        }

        for (const name of ['api', 'worker']) {
            assert(
                dependsOnCompletedRelease(deployment.services[name]),
                `${name} must wait for the release gate.`,
            );
        }

        validateRequiredEnvironment(deployment.services.api, apiEnvironmentVariables, 'api');
        validateRequiredEnvironment(
            deployment.services.worker,
            runtimeEnvironmentVariables,
            'worker',
        );
        for (const name of authenticationEnvironmentVariables) {
            assert(
                deployment.services.worker.environment?.[name] === undefined,
                `worker must not receive API-owned ${name}.`,
            );
        }
        assert(
            deployment.services.release.environment.APP_ENV === appEnvironment,
            'Release must use the selected environment.',
        );
        assert(
            deployment.services.api.environment.APP_ENV === appEnvironment,
            'API must use the selected environment.',
        );
        assert(
            deployment.services.worker.environment.APP_ENV === appEnvironment,
            'Worker must use the selected environment.',
        );
        assert(
            deployment.services.web.environment.APP_ENV === appEnvironment,
            'Web must use the selected environment so production hides internal previews.',
        );
        assert(
            deployment.services.api.environment.AUTH_BASE_URL ===
                (appEnvironment === 'uat'
                    ? 'https://uat.pick-flick.app'
                    : 'https://pick-flick.app'),
            'API must use the canonical authentication origin for its environment.',
        );
        assert(
            deployment.services.api.environment.APPLE_SIGN_IN_ENABLED === 'false',
            'API must keep Apple disabled.',
        );
        assert(
            deployment.services.web.environment.APPLE_SIGN_IN_ENABLED === 'false',
            'Web must keep Apple disabled.',
        );
        assert(
            deployment.services.api.environment.RESEND_DELIVERY_MODE === 'live',
            'API must use live Resend delivery.',
        );
        assert(
            deployment.services.worker.environment.RESEND_DELIVERY_MODE === 'live',
            'Worker must use live Resend delivery.',
        );
        assert(
            hasEnabledHealthCheck(deployment.services.api),
            'API must define an enabled health check.',
        );
        assert(
            hasEnabledHealthCheck(deployment.services.web),
            'Web must define an enabled health check.',
        );
        assert(
            hasIntendedHealthCheck(deployment.services.api, intendedHealthChecks.api),
            'API must define its intended health check.',
        );
        assert(
            hasIntendedHealthCheck(deployment.services.web, intendedHealthChecks.web),
            'Web must define its intended health check.',
        );
        assert(
            deployment.services.web.depends_on?.api?.condition === 'service_healthy',
            'Web must wait for API health.',
        );
        assert(
            deployment.services.web.depends_on?.api?.required === true,
            'Web must require API health.',
        );
        const backendInternalUrl = `http://pickflick-${appEnvironment}-api:3001`;
        assert(
            deployment.services.web.build?.args?.BACKEND_INTERNAL_URL === backendInternalUrl,
            'Web must build its same-origin API proxy against the environment-specific API alias.',
        );
        assert(
            deployment.services.web.environment?.BACKEND_INTERNAL_URL === backendInternalUrl,
            'Web must use the environment-specific API alias at runtime.',
        );
        assert(
            hasUniqueAliasOwners(deployment.services),
            `${appEnvironment} service aliases must each have one owner.`,
        );
        assert(
            deployment.networks.application.name === 'dokploy-network',
            "Application services must use Dokploy's shared network.",
        );
    }

    const uatAliases = applicationServices.flatMap(
        (name) => uat.services[name].networks.application.aliases,
    );
    const productionAliases = new Set(
        applicationServices.flatMap(
            (name) => production.services[name].networks.application.aliases,
        ),
    );
    assert(
        !uatAliases.some((alias) => productionAliases.has(alias)),
        'UAT and production service aliases must be environment-isolated.',
    );

    return { production, uat };
}

export function checkDeployment() {
    validatePreviewAuthContract();
    const deployments = {
        production: renderDeployment('production'),
        uat: renderDeployment('uat'),
    };

    return validateDeployments(deployments);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    checkDeployment();
    console.log(
        'Deployment Compose valid for authenticated preview and proportional UAT/production scopes.',
    );
}
