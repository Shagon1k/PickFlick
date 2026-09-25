import { createHash, createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../runtime.tokens.js';

interface StoredClubAvatar {
    readonly body: Buffer;
    readonly contentType: string;
}

export abstract class ClubAvatarStorage {
    abstract put(objectKey: string, body: Buffer, contentType: string): Promise<void>;
    abstract get(objectKey: string): Promise<StoredClubAvatar | undefined>;
    abstract delete(objectKey: string): Promise<void>;
}

function withoutTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') {
        end -= 1;
    }
    return path.slice(0, end);
}

function sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value).digest();
}

@Injectable()
export class S3ClubAvatarStorage extends ClubAvatarStorage {
    private readonly configuration: RuntimeEnvironment['storage'];

    constructor(@Inject(RUNTIME_ENVIRONMENT) environment: RuntimeEnvironment) {
        super();
        this.configuration = environment.storage;
    }

    async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
        const response = await this.request('PUT', objectKey, body, {
            'content-type': contentType,
        });
        if (!response.ok) {
            throw new Error(`Club avatar storage write failed with HTTP ${response.status}.`);
        }
    }

    async get(objectKey: string): Promise<StoredClubAvatar | undefined> {
        const response = await this.request('GET', objectKey);
        if (response.status === 404) {
            return undefined;
        }
        if (!response.ok) {
            throw new Error(`Club avatar storage read failed with HTTP ${response.status}.`);
        }
        return {
            body: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        };
    }

    async delete(objectKey: string): Promise<void> {
        const response = await this.request('DELETE', objectKey);
        if (!response.ok && response.status !== 404) {
            throw new Error(`Club avatar storage delete failed with HTTP ${response.status}.`);
        }
    }

    private target(objectKey: string): URL {
        const target = new URL(this.configuration.endpoint);
        const basePath = withoutTrailingSlashes(target.pathname);
        target.pathname = this.configuration.forcePathStyle
            ? `${basePath}/${this.configuration.bucket}/${objectKey}`
            : `${basePath}/${objectKey}`;
        if (!this.configuration.forcePathStyle) {
            target.hostname = `${this.configuration.bucket}.${target.hostname}`;
        }
        return target;
    }

    private async request(
        method: 'DELETE' | 'GET' | 'PUT',
        objectKey: string,
        body?: Buffer,
        extraHeaders: Record<string, string> = {},
    ): Promise<Response> {
        const target = this.target(objectKey);
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
        const date = timestamp.slice(0, 8);
        const payloadHash = sha256(body ?? '');
        const canonicalHeaders = `host:${target.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = [
            method,
            target.pathname,
            '',
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join('\n');
        const credentialScope = `${date}/${this.configuration.region}/s3/aws4_request`;
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            timestamp,
            credentialScope,
            sha256(canonicalRequest),
        ].join('\n');
        const dateKey = hmac(`AWS4${this.configuration.secretKey}`, date);
        const regionKey = hmac(dateKey, this.configuration.region);
        const serviceKey = hmac(regionKey, 's3');
        const signingKey = hmac(serviceKey, 'aws4_request');
        const signature = hmac(signingKey, stringToSign).toString('hex');
        return fetch(target, {
            method,
            headers: {
                authorization:
                    `AWS4-HMAC-SHA256 Credential=${this.configuration.accessKey}/${credentialScope}, ` +
                    `SignedHeaders=${signedHeaders}, Signature=${signature}`,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': timestamp,
                ...extraHeaders,
            },
            ...(body ? { body } : {}),
            signal: AbortSignal.timeout(5_000),
        });
    }
}
