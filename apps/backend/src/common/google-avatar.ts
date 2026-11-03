import { HttpStatus, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { detectImageType } from './image-type.js';

const AVATAR_HOST = 'lh3.googleusercontent.com';
const MAX_AVATAR_BYTES = 512 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5000;
const logger = new Logger('GoogleAvatar');

function parseAvatarUrl(source: string | null): URL {
    if (!source) throw new NotFoundException();
    let url: URL;
    try {
        url = new URL(source);
    } catch (error) {
        if (error instanceof TypeError) throw new NotFoundException();
        throw error;
    }
    if (
        url.protocol !== 'https:' ||
        url.hostname !== AVATAR_HOST ||
        url.username ||
        url.password ||
        url.port ||
        url.hash
    ) {
        throw new NotFoundException();
    }
    return url;
}

export async function downloadGoogleAvatar(source: string | null) {
    const url = parseAvatarUrl(source);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
        const response = await fetch(url, { redirect: 'error', signal: controller.signal });
        if (response.status === HttpStatus.NOT_FOUND || response.status === HttpStatus.GONE) {
            throw new NotFoundException();
        }
        if (!response.ok) unavailable('upstream_response');
        const body = await readBody(response);
        const contentType = detectImageType(body);
        if (!contentType) throw new NotFoundException();
        return { body, contentType };
    } catch (error) {
        if (error instanceof TypeError || error instanceof DOMException) {
            unavailable(controller.signal.aborted ? 'timeout' : 'network');
        }
        throw error;
    } finally {
        clearTimeout(timer);
        // Also stop unread bodies after a rejected response or an exceeded size limit.
        controller.abort();
    }
}

async function readBody(response: Response): Promise<Buffer> {
    if (!response.body || Number(response.headers.get('content-length')) > MAX_AVATAR_BYTES) {
        throw new NotFoundException();
    }
    // Node types fetch bodies loosely; undici yields byte chunks.
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return Buffer.concat(chunks, bytes);
            bytes += value.byteLength;
            if (bytes > MAX_AVATAR_BYTES) throw new NotFoundException();
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
}

function unavailable(reason: 'upstream_response' | 'timeout' | 'network'): never {
    logger.warn({ event: 'google_avatar.unavailable', reason });
    throw new ServiceUnavailableException({ reason: 'AVATAR_UNAVAILABLE' });
}
