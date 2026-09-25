import { createDatabaseClient } from '@pickflick/database';

import { identityUserLockKey } from '../../src/identity/identity-lock.js';
import type { AuthenticatedPrincipal } from '../../src/identity/authorization.types.js';
import { database, environment } from './context.js';
import {
    deterministicAuth,
    deterministicAuthorization,
    helpers,
    waitForBlockedIdentityLock,
} from './harness.js';

export async function checkConcurrentSuspension(
    registeredUser: { readonly id: string },
    adminPrincipal: AuthenticatedPrincipal,
) {
    const identityLockBlocker = createDatabaseClient(environment.databaseUrl);
    const lockKey = identityUserLockKey(registeredUser.id);
    let releaseIdentityLock: (() => void) | undefined;
    let signalIdentityLockHeld: (() => void) | undefined;
    const identityLockHeld = new Promise<void>((resolve) => {
        signalIdentityLockHeld = resolve;
    });
    const holdIdentityLock = new Promise<void>((resolve) => {
        releaseIdentityLock = resolve;
    });
    const blockingTransaction = identityLockBlocker.$transaction(
        async (transaction) => {
            await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            signalIdentityLockHeld?.();
            await holdIdentityLock;
        },
        { timeout: 30_000 },
    );
    try {
        await identityLockHeld;
        const sessionIssuance = helpers.login({ userId: registeredUser.id });
        await waitForBlockedIdentityLock(lockKey, 1);
        const suspension = deterministicAuthorization.suspendUser(
            adminPrincipal,
            registeredUser.id,
        );
        await waitForBlockedIdentityLock(lockKey, 2);
        releaseIdentityLock?.();

        const issuedSession = await sessionIssuance;
        await suspension;
        await blockingTransaction;
        if (
            (await database.authSession.count({ where: { userId: registeredUser.id } })) !== 0 ||
            (await database.user.findUnique({ where: { id: registeredUser.id } }))?.status !==
                'SUSPENDED'
        ) {
            throw new Error(
                'Concurrent session issuance and suspension left an active session or incorrect User status.',
            );
        }

        await database.user.update({
            data: { status: 'ACTIVE' },
            where: { id: registeredUser.id },
        });
        const revokedConcurrentSession = await deterministicAuth.handler(
            new Request(`${environment.auth.baseUrl}/api/auth/get-session`, {
                headers: issuedSession.headers,
            }),
        );
        if (!revokedConcurrentSession.ok || (await revokedConcurrentSession.json()) !== null) {
            throw new Error(
                'A session revoked by concurrent suspension became valid after reinstatement.',
            );
        }
    } finally {
        releaseIdentityLock?.();
        await blockingTransaction.catch(() => undefined);
        await identityLockBlocker.$disconnect();
    }
}
