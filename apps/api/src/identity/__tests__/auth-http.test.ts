import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { restrictAuthHandler } from '../auth-http.js';

interface RateLimitRow {
    count: number;
    id: string;
    key: string;
    lastRequest: bigint;
}

function databaseDouble(initialRows: readonly RateLimitRow[] = []) {
    const rows = new Map(initialRows.map((row) => [row.key, row]));
    const authRateLimit = {
        create: vi.fn(async ({ data }: { data: Omit<RateLimitRow, 'id'> }) => {
            const row = {
                ...data,
                id: `rate-limit-${rows.size + 1}`,
                lastRequest: BigInt(data.lastRequest),
            };
            rows.set(row.key, row);
            return row;
        }),
        deleteMany: vi.fn(async ({ where }: { where: { lastRequest: { lt: bigint } } }) => {
            let count = 0;
            for (const [key, row] of rows) {
                if (row.lastRequest < where.lastRequest.lt) {
                    rows.delete(key);
                    count += 1;
                }
            }
            return { count };
        }),
        findUnique: vi.fn(
            async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
        ),
        update: vi.fn(
            async ({
                data,
                where,
            }: {
                data: { count: number | { increment: number }; lastRequest?: number };
                where: { key: string };
            }) => {
                const current = rows.get(where.key);
                if (!current) {
                    throw new Error('Missing rate-limit row.');
                }
                const row = {
                    ...current,
                    count:
                        typeof data.count === 'number'
                            ? data.count
                            : current.count + data.count.increment,
                    lastRequest:
                        data.lastRequest === undefined
                            ? current.lastRequest
                            : BigInt(data.lastRequest),
                };
                rows.set(row.key, row);
                return row;
            },
        ),
    };
    const database = {
        authRateLimit,
        $executeRaw: vi.fn(async () => 1),
        $transaction: vi.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
            operation(database),
        ),
    };
    return { database, rows };
}

function requestDouble(address = '198.51.100.10'): IncomingMessage {
    return {
        headers: { 'x-forwarded-for': address },
        method: 'GET',
        socket: { remoteAddress: address },
        url: '/api/auth/get-session',
    } as unknown as IncomingMessage;
}

function responseDouble() {
    const headers = new Map<string, string>();
    let body = '';
    const response = {
        end: (chunk?: string) => {
            body = chunk ?? '';
        },
        setHeader: (name: string, value: string) => {
            headers.set(name, value);
        },
        statusCode: 200,
    } as unknown as ServerResponse;
    return { body: () => body, headers, response };
}

function authorizedOptions(
    database: unknown,
    resolveSession = vi.fn(async () => ({
        authorized: true as const,
        principal: { appRole: 'USER' as const, sessionId: 'session-id', userId: 'user-id' },
    })),
) {
    return {
        appleSignInEnabled: false,
        clientAddressHeader: 'x-forwarded-for' as const,
        database: database as never,
        listAccounts: vi.fn(async () => new Response('[]')),
        resolveSession,
    };
}

describe('authentication HTTP rate limits', () => {
    it('rate-limits get-session before authoritative session resolution', async () => {
        const { database } = databaseDouble();
        const resolveSession = vi.fn(async () => ({
            authorized: true as const,
            principal: { appRole: 'USER' as const, sessionId: 'session-id', userId: 'user-id' },
        }));
        const upstream = vi.fn(async (_request: IncomingMessage, response: ServerResponse) => {
            response.end('ok');
        });
        const handler = restrictAuthHandler(upstream, authorizedOptions(database, resolveSession));
        const statuses: number[] = [];

        for (let attempt = 0; attempt < 61; attempt += 1) {
            const { response } = responseDouble();
            await handler(requestDouble(), response);
            statuses.push(response.statusCode);
        }

        expect(statuses.slice(0, 60)).toEqual(Array.from({ length: 60 }, () => 200));
        expect(statuses[60]).toBe(429);
        expect(resolveSession).toHaveBeenCalledTimes(60);
        expect(upstream).toHaveBeenCalledTimes(60);
    });

    it('resets get-session on a fixed window even while requests keep arriving', async () => {
        vi.useFakeTimers();
        try {
            const startedAt = new Date('2026-09-25T12:00:00.000Z');
            vi.setSystemTime(startedAt);
            const { database } = databaseDouble();
            const handler = restrictAuthHandler(async (_request, response) => {
                response.end('ok');
            }, authorizedOptions(database));
            const request = async () => {
                const { response } = responseDouble();
                await handler(requestDouble(), response);
                return response.statusCode;
            };

            for (let attempt = 0; attempt < 30; attempt += 1) {
                expect(await request()).toBe(200);
            }
            vi.setSystemTime(startedAt.getTime() + 50_000);
            for (let attempt = 0; attempt < 30; attempt += 1) {
                expect(await request()).toBe(200);
            }
            expect(await request()).toBe(429);

            // A sliding "last request" timestamp would still block here, 11 seconds after the last hit.
            vi.setSystemTime(startedAt.getTime() + 61_000);
            expect(await request()).toBe(200);
        } finally {
            vi.useRealTimers();
        }
    });

    it('prunes rows older than the longest configured window when creating a bucket', async () => {
        const now = Date.now();
        const oldRow = {
            count: 1,
            id: 'old',
            key: 'old-client|/list-accounts',
            lastRequest: BigInt(now - 120_000),
        };
        const freshRow = {
            count: 1,
            id: 'fresh',
            key: 'fresh-client|/list-accounts',
            lastRequest: BigInt(now),
        };
        const { database, rows } = databaseDouble([oldRow, freshRow]);
        const handler = restrictAuthHandler(async (_request, response) => {
            response.end('ok');
        }, authorizedOptions(database));

        await handler(requestDouble('198.51.100.11'), responseDouble().response);

        expect(rows.has(oldRow.key)).toBe(false);
        expect(rows.has(freshRow.key)).toBe(true);
        expect(database.authRateLimit.deleteMany).toHaveBeenCalledOnce();
    });
});
