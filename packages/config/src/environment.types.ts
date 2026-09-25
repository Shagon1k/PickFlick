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

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface ValidationFailure {
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
