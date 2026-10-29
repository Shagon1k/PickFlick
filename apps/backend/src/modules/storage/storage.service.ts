import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    NoSuchKey,
    NotFound,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';

export interface IStoredObject {
    body: Buffer;
    contentType: string;
}

/** Private S3-compatible object storage (MinIO locally). The database keeps keys, never URLs. */
@Injectable()
export class StorageService {
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(@Inject(RUNTIME_ENVIRONMENT) { storage }: TRuntimeEnvironment) {
        this.bucket = storage.bucket;
        this.client = new S3Client({
            endpoint: storage.endpoint,
            region: storage.region,
            forcePathStyle: storage.forcePathStyle,
            credentials: { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey },
        });
    }

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }),
        );
    }

    async get(key: string): Promise<IStoredObject | null> {
        try {
            const object = await this.client.send(
                new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            );
            const body = await object.Body?.transformToByteArray();
            return body
                ? {
                      body: Buffer.from(body),
                      contentType: object.ContentType ?? 'application/octet-stream',
                  }
                : null;
        } catch (error) {
            if (error instanceof NoSuchKey) {
                return null;
            }
            throw error;
        }
    }

    /** Asks for the object's metadata only, so checking does not download the body. */
    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return true;
        } catch (error) {
            if (error instanceof NotFound) return false;
            throw error;
        }
    }

    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }

    /** Readiness probe: succeeds when the bucket is reachable with the configured credentials. */
    async ping(): Promise<void> {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    }
}
