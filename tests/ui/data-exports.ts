import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import type { TDataExportJob, TDataExportLink, TRequestDataExport } from '@pickflick/contracts';

import {
    readJson,
    rejectMethod,
    sendError,
    sendJson,
    type TMockRequest,
    type TMockResponse,
} from './mock-http.ts';

interface IExport {
    requestId: string;
    job: TDataExportJob;
    reads: number;
}

const exportsByToken = new Map<string, IExport>();
const failedRequests = new Set<string>();
const failedDownloads = new Set<string>();
const RESPONSE_DELAY_MS = 350;

function requestExport(request: TMockRequest, response: TMockResponse, token: string) {
    if (rejectMethod(request, response, 'POST')) return;
    readJson<TRequestDataExport>(request, ({ requestId }) => {
        const existing = exportsByToken.get(token);
        if (existing && existing.requestId !== requestId && existing.job.status === 'PENDING') {
            sendError(response, 409, 'CONFLICT', 'archive-active', 'EXPORT_IN_PROGRESS');
            return;
        }
        const job: TDataExportJob =
            existing?.requestId === requestId
                ? existing.job
                : {
                      id: randomUUID(),
                      status: 'PENDING',
                      attemptCount: 0,
                      createdAt: '2026-11-18T10:00:00.000Z',
                      completedAt: null,
                      expiresAt: null,
                      nextAttemptAt: '2026-11-18T10:00:00.000Z',
                      failure: null,
                  };
        exportsByToken.set(token, { requestId, job, reads: 0 });
        if (token.includes('archive-request-retry') && !failedRequests.has(token)) {
            failedRequests.add(token);
            sendError(response, 503, 'SERVICE_UNAVAILABLE', 'archive-response-lost');
            return;
        }
        setTimeout(() => sendJson(response, 202, job), RESPONSE_DELAY_MS);
    });
}

function getStatus(token: string, reads: number): TDataExportJob['status'] {
    if (token.includes('archive-failed')) return 'FAILED';
    if (token.includes('archive-expired')) return 'EXPIRED';
    return reads === 1 ? 'PROCESSING' : 'READY';
}

function readExport(response: TMockResponse, token: string, entry: IExport) {
    entry.reads += 1;
    if (token.includes('archive-status-retry') && entry.reads === 1) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'archive-status');
        return;
    }
    const status = getStatus(token, entry.reads);
    entry.job = {
        ...entry.job,
        status,
        attemptCount: 1,
        nextAttemptAt: null,
        completedAt: status === 'READY' ? '2026-11-18T10:01:00.000Z' : null,
        expiresAt: status === 'READY' ? '2026-11-25T10:01:00.000Z' : null,
        failure: status === 'FAILED' ? 'GENERATION_FAILED' : null,
    };
    sendJson(response, 200, entry.job);
}

function downloadExport(request: TMockRequest, response: TMockResponse, token: string) {
    if (rejectMethod(request, response, 'GET')) return;
    if (token.includes('archive-download-retry') && !failedDownloads.has(token)) {
        failedDownloads.add(token);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'archive-storage');
        return;
    }
    response.writeHead(200, {
        'content-type': 'application/gzip',
        'content-disposition': 'attachment; filename="pickflick-data.json.gz"',
    });
    response.end(gzipSync(JSON.stringify({ manifest: { version: 1 }, data: {} })));
}

export function handleDataExports(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token?: string,
): boolean {
    const match =
        /^\/account\/data-exports(?:\/([0-9a-f-]{36})(\/(?:download-link|download))?)?$/u.exec(
            pathname,
        );
    if (!match) return false;
    response.setHeader('cache-control', 'private, no-store');
    if (!token?.startsWith('valid') || token.includes('archive-unauthorized')) {
        sendError(response, 401, 'UNAUTHORIZED', 'archive-auth');
        return true;
    }
    if (!match[1]) {
        requestExport(request, response, token);
        return true;
    }
    const entry = exportsByToken.get(token);
    if (!entry || entry.job.id !== match[1]) {
        sendError(response, 404, 'NOT_FOUND', 'archive-private');
        return true;
    }
    if (!match[2]) {
        if (!rejectMethod(request, response, 'GET')) readExport(response, token, entry);
    } else if (match[2] === '/download-link') {
        if (rejectMethod(request, response, 'POST')) return true;
        readJson(request, () => {
            const link: TDataExportLink = {
                url: `/api/account/data-exports/${entry.job.id}/download?expires=1795083000000&signature=${'a'.repeat(64)}`,
                expiresAt: '2026-11-18T10:10:00.000Z',
            };
            sendJson(response, 200, link);
        });
    } else downloadExport(request, response, token);
    return true;
}
