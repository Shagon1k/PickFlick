import { connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { createHash, createHmac } from 'node:crypto';

import type { WorkerEnvironment } from '@pickflick/config/environment';
import type { DependencyName, ReadinessReport } from '@pickflick/contracts';

export interface DependencyProbe {
    readonly name: DependencyName;
    readonly check: (timeoutMilliseconds: number) => Promise<void>;
}

interface ProbeOptions {
    readonly fetch?: typeof fetch;
    readonly now?: Date;
    readonly timeoutMilliseconds?: number;
}

const defaultTimeoutMilliseconds = 2_000;

/**
 * Runs every required dependency probe concurrently and returns only its safe
 * status. Each probe receives the same deadline and enforces it at the driver or
 * socket boundary, so timed-out work is cancelled instead of continuing in the
 * background.
 */
export async function checkReadiness(
    probes: readonly DependencyProbe[],
    timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<ReadinessReport> {
    const checks = await Promise.all(
        probes.map(async ({ name, check }) => {
            try {
                await check(timeoutMilliseconds);
                return { name, status: 'up' as const };
            } catch {
                return { name, status: 'down' as const };
            }
        }),
    );

    return {
        status: checks.every(({ status }) => status === 'up') ? 'ready' : 'not_ready',
        checks,
    };
}

function redisCommand(parts: readonly string[]): string {
    return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

export async function checkRedis(
    redisUrl: string,
    timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<void> {
    const target = new URL(redisUrl);
    const secure = target.protocol === 'rediss:';
    const port = Number(target.port || (secure ? 6380 : 6379));

    await new Promise<void>((resolve, reject) => {
        const socket = secure
            ? connectTls({ host: target.hostname, port, servername: target.hostname })
            : connectTcp({ host: target.hostname, port });
        const timer = setTimeout(
            () => socket.destroy(new Error('Redis readiness check timed out.')),
            timeoutMilliseconds,
        );
        let response = '';

        const finish = (error?: Error) => {
            clearTimeout(timer);
            socket.destroy();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        socket.once(secure ? 'secureConnect' : 'connect', () => {
            const commands: string[] = [];
            if (target.password) {
                const username = decodeURIComponent(target.username || 'default');
                commands.push(
                    redisCommand(['AUTH', username, decodeURIComponent(target.password)]),
                );
            }
            commands.push(redisCommand(['PING']));
            socket.write(commands.join(''));
        });
        socket.on('data', (data) => {
            response += data.toString('utf8');
            if (response.includes('-ERR')) {
                finish(new Error('Redis readiness check was rejected.'));
            } else if (response.endsWith('+PONG\r\n')) {
                finish();
            }
        });
        socket.once('error', () => finish(new Error('Redis readiness check failed.')));
    });
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value).digest();
}

function bucketUrl(configuration: WorkerEnvironment['storage']): URL {
    const target = new URL(configuration.endpoint);
    if (configuration.forcePathStyle) {
        target.pathname = `${target.pathname.replace(/\/+$/, '')}/${configuration.bucket}`;
    } else {
        target.hostname = `${configuration.bucket}.${target.hostname}`;
    }
    return target;
}

function authorizationHeaders(
    configuration: WorkerEnvironment['storage'],
    target: URL,
    now: Date,
): Headers {
    const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const payloadHash = sha256('');
    const canonicalHeaders = `host:${target.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
        'HEAD',
        target.pathname,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');
    const credentialScope = `${date}/${configuration.region}/s3/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        timestamp,
        credentialScope,
        sha256(canonicalRequest),
    ].join('\n');
    const dateKey = hmac(`AWS4${configuration.secretKey}`, date);
    const regionKey = hmac(dateKey, configuration.region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign).toString('hex');

    return new Headers({
        authorization:
            `AWS4-HMAC-SHA256 Credential=${configuration.accessKey}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': timestamp,
    });
}

export async function checkStorage(
    configuration: WorkerEnvironment['storage'],
    options: ProbeOptions = {},
): Promise<void> {
    const target = bucketUrl(configuration);
    const signal = AbortSignal.timeout(options.timeoutMilliseconds ?? defaultTimeoutMilliseconds);

    let response: Response;
    try {
        response = await (options.fetch ?? fetch)(target, {
            method: 'HEAD',
            headers: authorizationHeaders(configuration, target, options.now ?? new Date()),
            signal,
        });
    } catch (error) {
        if (signal.aborted) {
            throw new Error('Object storage readiness check timed out.', { cause: error });
        }
        throw error;
    }

    if (!response.ok) {
        throw new Error(`Object storage readiness check failed with HTTP ${response.status}.`);
    }
}

export function createRuntimeDependencyProbes(
    environment: WorkerEnvironment,
    checkDatabase: (timeoutMilliseconds: number) => Promise<void>,
): readonly DependencyProbe[] {
    return [
        { name: 'database', check: checkDatabase },
        {
            name: 'redis',
            check: (timeoutMilliseconds) => checkRedis(environment.redisUrl, timeoutMilliseconds),
        },
        {
            name: 'objectStorage',
            check: (timeoutMilliseconds) =>
                checkStorage(environment.storage, { timeoutMilliseconds }),
        },
    ];
}
