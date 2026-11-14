import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { dataExportJobSchema, dataExportLinkSchema } from '@pickflick/contracts';

import {
    createUser,
    type ITestApi,
    loadIntegrationEnvironment,
    startTestApi,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { StorageService } from '../../storage/storage.service.js';
import { claimExport, EXPORT_AVAILABILITY_MS, getExportObjectKey } from '../data-export-store.js';
import { DataExportWorkerService } from '../data-export-worker.service.js';
import { DataExportsService } from '../data-exports.service.js';

describe('DataExportsController and worker', () => {
    let api: ITestApi;
    let owner: string;
    let other: string;
    const requestJob = () => api.dataExports.request(owner, randomUUID());
    const getJob = (id: string) => api.prisma.dataExportJob.findUniqueOrThrow({ where: { id } });
    const createLink = async (id: string) =>
        dataExportLinkSchema.parse(
            await (
                await api.expectStatus(200, `/account/data-exports/${id}/download-link`, {
                    userId: owner,
                    method: 'POST',
                    json: {},
                })
            ).json(),
        );
    const downloadPath = (url: string) => url.replace(/^\/api/u, '');

    beforeAll(async () => {
        api = await startTestApi();
        await api.dataExportWorker.onModuleDestroy();
        [owner, other] = await Promise.all([createUser(api.prisma), createUser(api.prisma)]);
    });
    beforeEach(async () => {
        await api.prisma.dataExportObject.deleteMany({ where: { job: { userId: owner } } });
        await api.prisma.dataExportJob.deleteMany({ where: { userId: owner } });
        await api.prisma.user.update({ where: { id: owner }, data: { status: 'ACTIVE' } });
        api.storage.objects.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });
    afterAll(async () => {
        await api.prisma.dataExportObject.deleteMany({ where: { job: { userId: owner } } });
        await api.prisma.dataExportJob.deleteMany({ where: { userId: owner } });
        await removeUsers(api.prisma, [owner, other]);
        await api.close();
    });

    it('should enqueue without generating, deduplicate concurrent requests and reject peer selectors', async () => {
        const requestId = randomUUID();
        const response = await api.expectStatus(202, '/account/data-exports', {
            userId: owner,
            method: 'POST',
            json: { requestId },
        });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        const job = dataExportJobSchema.parse(await response.json());
        expect(job.status).toBe('PENDING');
        expect(api.storage.objects.size).toBe(0);
        const duplicates = await Promise.all(
            Array.from({ length: 5 }, () => api.dataExports.request(owner, requestId)),
        );
        expect(duplicates.map(({ id }) => id)).toEqual(Array(5).fill(job.id));
        await expect(requestJob()).rejects.toThrow('Conflict');
        await api.expectStatus(400, '/account/data-exports', {
            userId: owner,
            method: 'POST',
            json: { requestId, userId: other },
        });
        await api.expectStatus(400, `/account/data-exports/${job.id}?userId=${other}`, {
            userId: owner,
        });
        await api.expectStatus(401, `/account/data-exports/${job.id}`);
        await api.expectStatus(404, `/account/data-exports/${job.id}`, { userId: other });
        await api.expectStatus(404, `/account/data-exports/${randomUUID()}`, { userId: other });
        await api.expectStatus(404, `/account/data-exports/${job.id}/download-link`, {
            userId: owner,
            method: 'POST',
            json: {},
        });
    });

    it('should issue session-bound signed downloads capped by the fixed seven-day expiry', async () => {
        const job = await requestJob();
        await api.dataExportWorker.sweep();
        const ready = await getJob(job.id);
        expect(ready.status).toBe('READY');
        expect(ready.expiresAt!.getTime() - ready.completedAt!.getTime()).toBe(
            EXPORT_AVAILABILITY_MS,
        );
        const link = await createLink(job.id);
        const response = await api.expectStatus(200, downloadPath(link.url), { userId: owner });
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(response.headers.get('content-disposition')).toContain('attachment');
        expect(Buffer.from(await response.arrayBuffer())).toEqual(
            api.storage.objects.get(ready.objectKey!)!.body,
        );
        await api.expectStatus(401, downloadPath(link.url));
        await api.expectStatus(404, downloadPath(link.url), { userId: other });
        await api.expectStatus(404, `/account/data-exports/${job.id}/download-link`, {
            userId: other,
            method: 'POST',
            json: {},
        });
        const modified = new URL(link.url, 'http://localhost');
        modified.searchParams.set('signature', '0'.repeat(64));
        await api.expectStatus(404, downloadPath(`${modified.pathname}${modified.search}`), {
            userId: owner,
        });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(link.expiresAt));
        await api.expectStatus(404, downloadPath(link.url), { userId: owner });
        vi.setSystemTime(new Date(ready.expiresAt!.getTime() - 1000));
        const lastLink = await createLink(job.id);
        expect(lastLink.expiresAt).toBe(ready.expiresAt!.toISOString());
        expect((await getJob(job.id)).expiresAt).toEqual(ready.expiresAt);
        vi.setSystemTime(ready.expiresAt!);
        await api.expectStatus(404, downloadPath(lastLink.url), { userId: owner });
        expect((await api.dataExports.get(owner, job.id)).status).toBe('EXPIRED');
    });

    it('should retry storage failures with fixed observable reasons and recover abandoned objects', async () => {
        const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        const put = vi
            .spyOn(api.storage, 'put')
            .mockRejectedValueOnce(new Error('PRIVATE CONTENT credentials=secret'));
        await api.dataExportWorker.sweep();
        expect(await getJob(job.id)).toMatchObject({
            status: 'PENDING',
            attemptCount: 1,
            failure: 'GENERATION_FAILED',
        });
        await api.dataExportWorker.sweep();
        expect(put).toHaveBeenCalledTimes(1);
        await api.prisma.dataExportJob.update({
            where: { id: job.id },
            data: { nextAttemptAt: new Date(0) },
        });
        await Promise.all([
            api.dataExportWorker.sweep(),
            new DataExportWorkerService(api.prisma, api.storage).sweep(),
        ]);
        expect(await getJob(job.id)).toMatchObject({
            status: 'READY',
            attemptCount: 2,
            failure: null,
        });
        expect(put).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(log.mock.calls)).not.toMatch(
            /PRIVATE|credentials|secret|example.invalid/,
        );
        expect(log).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'export.retry.scheduled', jobId: job.id, attempt: 1 }),
        );
        await api.dataExportWorker.sweep(new Date(Date.now() + 61 * 60_000));
        expect(await api.prisma.dataExportObject.count({ where: { jobId: job.id } })).toBe(1);
    });

    it('should reclaim interrupted work and stop after bounded failures without duplicate artifacts', async () => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        const abandoned = await claimExport(api.prisma, new Date());
        expect(abandoned).not.toBeNull();
        await api.storage.put(
            getExportObjectKey(abandoned!),
            Buffer.from('partial'),
            'application/gzip',
        );
        await api.prisma.dataExportJob.update({
            where: { id: job.id },
            data: { leaseUntil: new Date(0) },
        });
        vi.spyOn(api.storage, 'put').mockRejectedValue(new Error('unavailable'));
        await api.dataExportWorker.sweep();
        await api.prisma.dataExportJob.update({
            where: { id: job.id },
            data: { nextAttemptAt: new Date(0) },
        });
        await api.dataExportWorker.sweep();
        expect(await getJob(job.id)).toMatchObject({
            status: 'FAILED',
            attemptCount: 3,
            failure: 'GENERATION_FAILED',
        });
        await api.dataExportWorker.sweep();
        expect((await getJob(job.id)).attemptCount).toBe(3);
        await api.dataExportWorker.sweep(new Date(Date.now() + 61 * 60_000));
        expect(api.storage.objects.size).toBe(0);
        expect(await api.prisma.dataExportObject.count({ where: { jobId: job.id } })).toBe(0);
        expect((await requestJob()).id).not.toBe(job.id);
    });

    it('should fence a late worker so its object cannot replace the recovered winner', async () => {
        const job = await requestJob();
        let release: () => void = () => undefined;
        let notifyStarted: () => void = () => undefined;
        const started = new Promise<void>((resolve) => {
            notifyStarted = resolve;
        });
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const originalPut = api.storage.put.bind(api.storage);
        vi.spyOn(api.storage, 'put').mockImplementationOnce(async (key, body, contentType) => {
            notifyStarted();
            await gate;
            await originalPut(key, body, contentType);
        });
        const stale = api.dataExportWorker.sweep();
        await started;
        await api.prisma.dataExportJob.update({
            where: { id: job.id },
            data: { leaseUntil: new Date(0) },
        });
        await new DataExportWorkerService(api.prisma, api.storage).sweep();
        const winner = await getJob(job.id);
        release();
        await stale;
        expect((await getJob(job.id)).objectKey).toBe(winner.objectKey);
        expect((await getJob(job.id)).attemptCount).toBe(2);
        expect(api.storage.objects.size).toBe(2);
        await api.dataExportWorker.sweep(new Date(Date.now() + 61 * 60_000));
        expect([...api.storage.objects.keys()]).toEqual([winner.objectKey]);
    });

    it('should deny inactive accounts and retry expiry cleanup without extending availability', async () => {
        const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        await api.dataExportWorker.sweep();
        const ready = await getJob(job.id);
        const link = await createLink(job.id);
        await api.prisma.user.update({ where: { id: owner }, data: { status: 'ANONYMIZED' } });
        await api.expectStatus(404, downloadPath(link.url), { userId: owner });
        const deletion = vi
            .spyOn(api.storage, 'delete')
            .mockRejectedValueOnce(new Error('secret storage failure'));
        await api.dataExportWorker.sweep();
        expect((await getJob(job.id)).status).toBe('EXPIRED');
        expect(api.storage.objects.has(ready.objectKey!)).toBe(true);
        expect(await api.prisma.dataExportObject.count({ where: { jobId: job.id } })).toBe(1);
        await api.dataExportWorker.sweep();
        expect(deletion).toHaveBeenCalledTimes(2);
        expect(api.storage.objects.size).toBe(0);
        expect(log).toHaveBeenCalledWith({ event: 'export.cleanup.failed', jobId: job.id });
        expect((await getJob(job.id)).expiresAt).toEqual(ready.expiresAt);
    });

    it('should expire downloads at the deadline while storage deletion is unavailable', async () => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        await api.dataExportWorker.sweep();
        const ready = await getJob(job.id);
        const link = await createLink(job.id);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(ready.expiresAt!);
        vi.spyOn(api.storage, 'delete').mockRejectedValue(new Error('storage down'));
        await api.dataExportWorker.sweep();
        expect((await getJob(job.id)).status).toBe('EXPIRED');
        expect(api.storage.objects.has(ready.objectKey!)).toBe(true);
        await api.expectStatus(404, downloadPath(link.url), { userId: owner });
        await api.expectStatus(404, `/account/data-exports/${job.id}/download-link`, {
            userId: owner,
            method: 'POST',
            json: {},
        });
    });

    it('should keep real S3 objects private while allowing the authenticated signed application download', async () => {
        const environment = loadIntegrationEnvironment();
        const storage = new StorageService(environment);
        const worker = new DataExportWorkerService(api.prisma, storage);
        const exports = new DataExportsService(api.prisma, storage);
        const job = await requestJob();
        await worker.sweep();
        const ready = await getJob(job.id);
        try {
            expect(ready.status).toBe('READY');
            const anonymous = await fetch(
                `${environment.storage.endpoint}/${environment.storage.bucket}/${ready.objectKey}`,
            );
            expect(anonymous.status).toBe(403);
            const link = await exports.createLink(owner, job.id);
            const url = new URL(link.url, 'http://localhost');
            const body = await exports.download(owner, job.id, {
                expires: url.searchParams.get('expires')!,
                signature: url.searchParams.get('signature')!,
            });
            expect(body.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
        } finally {
            if (ready.objectKey) await storage.delete(ready.objectKey);
        }
    });

    it('should expose missing artifacts as a failure and reject a download expiring during its read', async () => {
        const job = await requestJob();
        await api.dataExportWorker.sweep();
        const ready = await getJob(job.id);
        const link = await createLink(job.id);
        const object = api.storage.objects.get(ready.objectKey!)!;
        api.storage.objects.delete(ready.objectKey!);
        await api.expectStatus(503, downloadPath(link.url), { userId: owner });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.spyOn(api.storage, 'get').mockImplementationOnce(async () => {
            vi.setSystemTime(new Date(link.expiresAt));
            return object;
        });
        await api.expectStatus(404, downloadPath(link.url), { userId: owner });
    });

    it('should fail an interrupted final attempt without claiming a fourth generation', async () => {
        const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        await api.prisma.dataExportJob.update({ where: { id: job.id }, data: { attemptCount: 2 } });
        await claimExport(api.prisma, new Date());
        await api.prisma.dataExportJob.update({
            where: { id: job.id },
            data: { leaseUntil: new Date(0) },
        });
        await api.dataExportWorker.sweep();
        expect(await getJob(job.id)).toMatchObject({
            status: 'FAILED',
            attemptCount: 3,
            failure: 'GENERATION_FAILED',
        });
        expect(api.storage.objects.size).toBe(0);
        expect(log).toHaveBeenCalledWith({ event: 'export.claims.exhausted', count: 1 });
    });

    it('should reject generation after account deactivation', async () => {
        vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const job = await requestJob();
        await api.prisma.user.update({ where: { id: owner }, data: { status: 'ANONYMIZED' } });
        await api.dataExportWorker.sweep();
        expect(await getJob(job.id)).toMatchObject({
            status: 'FAILED',
            failure: 'ACCOUNT_UNAVAILABLE',
        });
        expect(api.storage.objects.size).toBe(0);
    });
});
