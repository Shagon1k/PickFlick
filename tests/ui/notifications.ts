import type { TNotificationItem, TNotificationList } from '@pickflick/contracts';

import { sendError, sendJson, type TMockRequest, type TMockResponse } from './mock-http.ts';

const notifications = new Map<string, TNotificationItem[]>();
const streams = new Map<string, Set<TMockResponse>>();
const failedLoads = new Set<string>();
const PAGE_SIZE = 20;
const LOADING_MS = 1_500;

function getItems(token: string): TNotificationItem[] {
    const href = token.includes('navigation')
        ? '/clubs/10000000-0000-4000-8000-000000000031/achievements'
        : '/app';
    let items = notifications.get(token);
    if (!items) {
        items = token.includes('notifications')
            ? Array.from({ length: 23 }, (_, index) => ({
                  id: `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
                  event: 'SESSION_STARTED',
                  message:
                      index === 2
                          ? 'This update is no longer available.'
                          : 'A new Session has started.',
                  href: index === 2 ? null : href,
                  createdAt: '2026-10-27T07:00:00.000Z',
                  readAt: index < 3 ? null : '2026-10-27T07:30:00.000Z',
              }))
            : [];
        notifications.set(token, items);
    }
    return items;
}

function openStream(response: TMockResponse, key: string) {
    response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'private, no-store, no-transform',
    });
    response.write(': connected\n\n');
    const clients = streams.get(key) ?? new Set<TMockResponse>();
    streams.set(key, clients);
    clients.add(response);
    const heartbeat = setInterval(() => response.write('event: heartbeat\ndata: \n\n'), 100);
    response.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(response);
    });
}

function listNotifications(request: TMockRequest, response: TMockResponse, key: string) {
    if (key.includes('load-error') && !failedLoads.has(key)) {
        failedLoads.add(key);
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'notification-load-error');
        return;
    }
    const items = getItems(key);
    const cursor = new URL(request.url!, 'http://localhost').searchParams.get('cursor');
    const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
    const page = items.slice(start, start + PAGE_SIZE);
    const result: TNotificationList = {
        items: page,
        nextCursor: start + PAGE_SIZE < items.length ? page.at(-1)!.id : null,
        unreadCount: items.filter((item) => item.readAt === null).length,
    };
    if (key.includes('loading')) setTimeout(() => sendJson(response, 200, result), LOADING_MS);
    else sendJson(response, 200, result);
}

function markRead(response: TMockResponse, pathname: string, key: string) {
    if (key.includes('expired-session')) {
        sendError(response, 401, 'UNAUTHORIZED', 'notification-session-ended');
        return;
    }
    if (key.includes('save-error')) {
        sendError(response, 503, 'SERVICE_UNAVAILABLE', 'notification-save-error');
        return;
    }
    const id = pathname.split('/')[2];
    for (const item of getItems(key)) {
        if ((id === 'read' || id === item.id) && item.readAt === null)
            item.readAt = '2026-10-27T08:00:00.000Z';
    }
    response.writeHead(204).end();
    for (const client of streams.get(key) ?? []) client.write('data: {"refresh":true}\n\n');
}

export function handleNotifications(
    request: TMockRequest,
    response: TMockResponse,
    pathname: string,
    token?: string,
): boolean {
    if (!pathname.startsWith('/notifications')) return false;
    const key = token ?? 'anonymous-shell';
    if (pathname === '/notifications/stream') {
        openStream(response, key);
        return true;
    }
    if (request.method === 'GET' && pathname === '/notifications') {
        listNotifications(request, response, key);
        return true;
    }
    if (request.method === 'POST' && pathname.endsWith('/read')) {
        markRead(response, pathname, key);
        return true;
    }
    response.writeHead(404).end();
    return true;
}
