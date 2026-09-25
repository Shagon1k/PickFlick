import { randomUUID } from 'node:crypto';

import { database } from './context.js';
import {
    deterministicAuthorization,
    deterministicHttpBaseUrl,
    helpers,
    userIds,
} from './harness.js';

export async function checkAppAuthorization() {
    const adminUserId = randomUUID();
    const suspendedUserId = randomUUID();
    const roleTargetUserId = randomUUID();
    userIds.add(adminUserId);
    userIds.add(suspendedUserId);
    userIds.add(roleTargetUserId);
    await database.user.createMany({
        data: [
            {
                appRole: 'APP_ADMIN',
                displayName: 'Auth Check Admin',
                email: `auth-admin-${randomUUID()}@example.invalid`,
                emailVerified: true,
                id: adminUserId,
            },
            {
                displayName: 'Suspension Target',
                email: `auth-suspended-${randomUUID()}@example.invalid`,
                emailVerified: true,
                id: suspendedUserId,
            },
            {
                displayName: 'Role Target',
                email: `auth-role-${randomUUID()}@example.invalid`,
                emailVerified: true,
                id: roleTargetUserId,
            },
        ],
    });
    const adminPrincipal = {
        appRole: 'APP_ADMIN',
        sessionId: 'integration-admin',
        userId: adminUserId,
    } as const;
    const suspendedLogin = await helpers.login({ userId: suspendedUserId });
    await helpers.login({ userId: suspendedUserId });
    await deterministicAuthorization.suspendUser(adminPrincipal, suspendedUserId);
    const suspendedSession = await deterministicAuthorization.resolveSession(
        Object.fromEntries(suspendedLogin.headers.entries()),
    );
    if (
        suspendedSession.authorized ||
        suspendedSession.reason !== 'invalid_session' ||
        (await database.authSession.count({ where: { userId: suspendedUserId } })) !== 0 ||
        (await database.user.findUnique({ where: { id: suspendedUserId } }))?.status !== 'SUSPENDED'
    ) {
        throw new Error('Suspension did not deny access and revoke every User session.');
    }
    const suspendedSessionProjection = await fetch(
        `${deterministicHttpBaseUrl}/api/auth/get-session`,
        {
            headers: suspendedLogin.headers,
        },
    );
    if (
        suspendedSessionProjection.status !== 200 ||
        (await suspendedSessionProjection.json()) !== null
    ) {
        throw new Error('A suspended User received an authenticated session projection.');
    }

    const roleTargetLogin = await helpers.login({ userId: roleTargetUserId });
    await deterministicAuthorization.setAppRole(adminPrincipal, roleTargetUserId, 'APP_ADMIN');
    if (
        (await database.authSession.findUnique({ where: { token: roleTargetLogin.token } })) ||
        !(await deterministicAuthorization.authorizeBackgroundUser(roleTargetUserId, ['APP_ADMIN']))
    ) {
        throw new Error(
            'An App role change did not revoke sessions or update background authorization.',
        );
    }
    const postRoleChangeLogin = await helpers.login({ userId: roleTargetUserId });
    await deterministicAuthorization.setAppRole(adminPrincipal, roleTargetUserId, 'APP_ADMIN');
    if (!(await database.authSession.findUnique({ where: { token: postRoleChangeLogin.token } }))) {
        throw new Error('An unchanged App role retry revoked a newly issued session.');
    }
    return { adminPrincipal };
}
