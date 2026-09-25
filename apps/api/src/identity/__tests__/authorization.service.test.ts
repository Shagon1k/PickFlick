import { Writable } from 'node:stream';

import { createLogger } from '@pickflick/observability';
import { describe, expect, it, vi } from 'vitest';

import { IdentityAuthorizationService } from '../authorization.service.js';
import type { AuthenticatedPrincipal } from '../authorization.types.js';

function testLogger() {
    let output = '';
    const destination = new Writable({
        write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
        },
    });
    return {
        logger: createLogger({ environment: 'test', service: 'api', destination }),
        output: () => output,
    };
}

function databaseDouble(
    user: { appRole: 'USER' | 'APP_ADMIN'; status: 'ACTIVE' | 'SUSPENDED' } | null,
    userId = 'user-id',
) {
    const database = {
        authSession: {
            deleteMany: vi.fn(async () => ({ count: 1 })),
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
                user
                    ? {
                          expiresAt: new Date(Date.now() + 60_000),
                          id: where.id,
                          user: { ...user, id: userId },
                      }
                    : null,
            ),
        },
        user: {
            findUnique: vi.fn(async () => user),
            update: vi.fn(async () => user),
        },
        $executeRaw: vi.fn(async () => 1),
        $transaction: vi.fn(async (operation: (transaction: unknown) => Promise<void>) =>
            operation(database),
        ),
    };
    return database;
}

const admin: AuthenticatedPrincipal = {
    appRole: 'APP_ADMIN',
    sessionId: 'admin-session',
    userId: 'admin-user',
};
const user: AuthenticatedPrincipal = {
    appRole: 'USER',
    sessionId: 'user-session',
    userId: 'ordinary-user',
};

describe('IdentityAuthorizationService', () => {
    it('resolves the current active User role from the database', async () => {
        const database = databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' });
        const logs = testLogger();
        const authorization = new IdentityAuthorizationService(
            database as never,
            logs.logger,
            async () => ({
                session: { expiresAt: new Date(Date.now() + 60_000), id: 'session-id' },
                user: { id: 'user-id' },
            }),
        );

        await expect(authorization.resolveSession({ cookie: 'private-cookie' })).resolves.toEqual({
            authorized: true,
            principal: { appRole: 'APP_ADMIN', sessionId: 'session-id', userId: 'user-id' },
        });
    });

    it('denies an expired session before reading authorization data', async () => {
        const database = databaseDouble({ appRole: 'USER', status: 'ACTIVE' });
        const authorization = new IdentityAuthorizationService(
            database as never,
            testLogger().logger,
            async () => ({
                session: { expiresAt: new Date(Date.now() - 1_000), id: 'expired-session' },
                user: { id: 'user-id' },
            }),
        );

        await expect(authorization.resolveSession({})).resolves.toEqual({
            authorized: false,
            reason: 'invalid_session',
        });
        expect(database.authSession.findUnique).not.toHaveBeenCalled();
    });

    it('fails closed without logging resolver error details', async () => {
        const logs = testLogger();
        const authorization = new IdentityAuthorizationService(
            databaseDouble({ appRole: 'USER', status: 'ACTIVE' }) as never,
            logs.logger,
            async () => {
                throw new Error('private database detail');
            },
        );

        await expect(authorization.resolveSession({ cookie: 'private-cookie' })).resolves.toEqual({
            authorized: false,
            reason: 'service_unavailable',
        });
        expect(logs.output()).toContain('"reason":"service_unavailable"');
        expect(logs.output()).not.toContain('private database detail');
        expect(logs.output()).not.toContain('private-cookie');
    });

    it('denies a suspended User, revokes all sessions, and logs no identifiers', async () => {
        const database = databaseDouble(
            { appRole: 'USER', status: 'SUSPENDED' },
            'private-user-id',
        );
        const logs = testLogger();
        const authorization = new IdentityAuthorizationService(
            database as never,
            logs.logger,
            async () => ({
                session: { expiresAt: new Date(Date.now() + 60_000), id: 'private-session-id' },
                user: { id: 'private-user-id' },
            }),
        );

        await expect(authorization.resolveSession({ cookie: 'private-cookie' })).resolves.toEqual({
            authorized: false,
            reason: 'inactive_user',
        });
        expect(database.authSession.deleteMany).toHaveBeenCalledWith({
            where: { userId: 'private-user-id' },
        });
        expect(logs.output()).toContain('"reason":"inactive_user"');
        expect(logs.output()).not.toContain('private-session-id');
        expect(logs.output()).not.toContain('private-user-id');
        expect(logs.output()).not.toContain('private-cookie');
    });

    it('denies a session revoked between preliminary parsing and the atomic authorization snapshot', async () => {
        const database = databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' });
        database.authSession.findUnique.mockResolvedValueOnce(null);
        const authorization = new IdentityAuthorizationService(
            database as never,
            testLogger().logger,
            async () => ({
                session: { expiresAt: new Date(Date.now() + 60_000), id: 'revoked-session' },
                user: { id: 'user-id' },
            }),
        );

        await expect(authorization.resolveSession({})).resolves.toEqual({
            authorized: false,
            reason: 'invalid_session',
        });
        expect(database.user.findUnique).not.toHaveBeenCalled();
    });

    it('rechecks status and role before a background-sensitive action', async () => {
        const activeAdmin = new IdentityAuthorizationService(
            databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' }) as never,
            testLogger().logger,
            async () => null,
        );
        const suspendedAdmin = new IdentityAuthorizationService(
            databaseDouble({ appRole: 'APP_ADMIN', status: 'SUSPENDED' }) as never,
            testLogger().logger,
            async () => null,
        );

        await expect(activeAdmin.authorizeBackgroundUser('admin', ['APP_ADMIN'])).resolves.toBe(
            true,
        );
        await expect(activeAdmin.authorizeBackgroundUser('admin', ['USER'])).resolves.toBe(false);
        await expect(suspendedAdmin.authorizeBackgroundUser('admin', ['APP_ADMIN'])).resolves.toBe(
            false,
        );
    });

    it('requires APP_ADMIN for suspension and revokes sessions in the same transaction', async () => {
        const userDatabase = databaseDouble({ appRole: 'USER', status: 'ACTIVE' });
        const userAuthorization = new IdentityAuthorizationService(
            userDatabase as never,
            testLogger().logger,
            async () => null,
        );

        await expect(userAuthorization.suspendUser(user, 'target-user')).rejects.toMatchObject({
            status: 403,
        });
        expect(userDatabase.user.update).not.toHaveBeenCalled();

        const adminDatabase = databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' });
        const adminAuthorization = new IdentityAuthorizationService(
            adminDatabase as never,
            testLogger().logger,
            async () => null,
        );
        await adminAuthorization.suspendUser(admin, 'target-user');
        expect(adminDatabase.user.update).toHaveBeenCalledWith({
            data: { status: 'SUSPENDED' },
            where: { id: 'target-user' },
        });
        expect(adminDatabase.authSession.deleteMany).toHaveBeenCalledWith({
            where: { userId: 'target-user' },
        });
    });

    it('revokes every session after an App role change', async () => {
        const database = databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' });
        const authorization = new IdentityAuthorizationService(
            database as never,
            testLogger().logger,
            async () => null,
        );

        await authorization.setAppRole(admin, 'target-user', 'USER');

        expect(database.user.update).toHaveBeenCalledWith({
            data: { appRole: 'USER' },
            where: { id: 'target-user' },
        });
        expect(database.authSession.deleteMany).toHaveBeenCalledWith({
            where: { userId: 'target-user' },
        });
    });

    it('does not revoke sessions when the App role is unchanged', async () => {
        const database = databaseDouble({ appRole: 'APP_ADMIN', status: 'ACTIVE' });
        const authorization = new IdentityAuthorizationService(
            database as never,
            testLogger().logger,
            async () => null,
        );

        await authorization.setAppRole(admin, 'target-user', 'APP_ADMIN');

        expect(database.user.update).not.toHaveBeenCalled();
        expect(database.authSession.deleteMany).not.toHaveBeenCalled();
    });
});
