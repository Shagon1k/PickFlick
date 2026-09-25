import { randomUUID } from 'node:crypto';

import { SYNTHETIC_FIXTURES } from '@pickflick/database';

import { ClubAuthorizationError, ClubConflictError } from '../../src/clubs/club.errors.js';
import { database, ids, policy, principal, transitions } from './harness.js';

export async function checkPoliciesAndRoles() {
    const [adminPolicy, moderatorPolicy, memberPolicy, seededProPolicy] = await Promise.all([
        policy.project(principal(ids.admin), ids.club),
        policy.project(principal(ids.moderator), ids.club),
        policy.project(principal(ids.member.toUpperCase()), ids.club.toUpperCase()),
        policy.project(
            principal(SYNTHETIC_FIXTURES.users[0].id.toUpperCase()),
            SYNTHETIC_FIXTURES.club.id.toUpperCase(),
        ),
    ]);
    if (
        !adminPolicy.permissions.manageRoles ||
        'transferAdministration' in adminPolicy.permissions ||
        !moderatorPolicy.permissions.manageSessions
    ) {
        throw new Error('Admin or Moderator policy projection is missing an allowed action.');
    }
    if (memberPolicy.permissions.manageSessions || memberPolicy.entitlements.tier !== 'FREE') {
        throw new Error('Member policy or static tier limits exceed the approved Free boundary.');
    }
    if (
        seededProPolicy.entitlements.tier !== 'PRO' ||
        seededProPolicy.entitlements.memberLimit !== 16
    ) {
        throw new Error('The seeded Pro Club did not receive its approved tier limits.');
    }
    await policy.project(principal(ids.outsider), ids.club).then(
        () => {
            throw new Error('A non-member received a Club policy projection.');
        },
        () => undefined,
    );
    await policy.project(principal(ids.suspended), ids.club).then(
        () => {
            throw new Error('A suspended User received a Club policy projection.');
        },
        () => undefined,
    );

    const roleOperationId = randomUUID();
    const roleInput = {
        actorUserId: ids.admin,
        clubId: ids.club,
        nextRole: 'MODERATOR' as const,
        operationId: roleOperationId,
        targetMembershipId: ids.memberMembership,
    };
    const roleChange = await transitions.changeMembershipRole(roleInput);
    const roleRetry = await transitions.changeMembershipRole({
        ...roleInput,
        actorUserId: roleInput.actorUserId.toUpperCase(),
        clubId: roleInput.clubId.toUpperCase(),
        operationId: roleInput.operationId.toUpperCase(),
        targetMembershipId: roleInput.targetMembershipId.toUpperCase(),
    });
    if (
        !roleChange.changed ||
        roleChange.replayed ||
        !roleRetry.changed ||
        !roleRetry.replayed ||
        roleChange.auditEventId !== roleRetry.auditEventId
    ) {
        throw new Error('Membership role retry did not return the original audited result.');
    }
    if ((await database.clubAuditEvent.count({ where: { operationId: roleOperationId } })) !== 1) {
        throw new Error('Membership role retry emitted more than one audit event.');
    }

    const noOpOperationId = randomUUID();
    const noOpInput = { ...roleInput, operationId: noOpOperationId };
    const noOp = await transitions.changeMembershipRole(noOpInput);
    const noOpReceipt = await database.clubAuditEvent.findUnique({
        where: { operationId: noOpOperationId },
    });
    if (noOp.changed || noOpReceipt?.changed !== false) {
        throw new Error('An accepted no-op Membership role change did not persist its result.');
    }
    await transitions.changeMembershipRole({
        ...roleInput,
        nextRole: 'MEMBER',
        operationId: randomUUID(),
    });
    const noOpRetry = await transitions.changeMembershipRole({
        ...noOpInput,
        operationId: noOpInput.operationId.toUpperCase(),
        targetMembershipId: noOpInput.targetMembershipId.toUpperCase(),
    });
    const roleAfterNoOpRetry = await database.membership.findUnique({
        where: { id: ids.memberMembership },
        select: { role: true },
    });
    if (noOpRetry.changed || roleAfterNoOpRetry?.role !== 'MEMBER') {
        throw new Error('A retried no-op Membership role operation changed a later role state.');
    }

    await transitions
        .changeMembershipRole({
            ...roleInput,
            actorUserId: ids.moderator,
            operationId: randomUUID(),
        })
        .then(
            () => {
                throw new Error('A Moderator changed a Membership role.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubAuthorizationError)) {
                    throw error;
                }
            },
        );

    await database.club.update({ where: { id: ids.club }, data: { lifecycle: 'ARCHIVED' } });
    await transitions
        .changeMembershipRole({ ...roleInput, nextRole: 'MEMBER', operationId: randomUUID() })
        .then(
            () => {
                throw new Error('An archived Club allowed an ordinary Membership role change.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubConflictError)) {
                    throw error;
                }
            },
        );
    await database.club.update({ where: { id: ids.club }, data: { lifecycle: 'ACTIVE' } });

    await transitions
        .transferAdministration({
            actorUserId: ids.admin,
            clubId: ids.club,
            operationId: randomUUID(),
            previousAdminNextRole: 'MEMBER',
            targetMembershipId: ids.moderatorMembership,
        })
        .then(
            () => {
                throw new Error('A Club Admin used the App Admin ownership-transfer path.');
            },
            (error: unknown) => {
                if (!(error instanceof ClubAuthorizationError)) {
                    throw error;
                }
            },
        );

    for (const [status, targetMembershipId] of [
        ['suspended', ids.suspendedMembership],
        ['anonymized', ids.anonymizedMembership],
    ] as const) {
        await transitions
            .transferAdministration({
                actorUserId: ids.appAdmin,
                clubId: ids.club,
                operationId: randomUUID(),
                previousAdminNextRole: 'MEMBER',
                targetMembershipId,
            })
            .then(
                () => {
                    throw new Error(`A ${status} User became the Club Admin.`);
                },
                (error: unknown) => {
                    if (!(error instanceof ClubConflictError)) {
                        throw error;
                    }
                },
            );
    }

    const transferOperationId = randomUUID();
    const transferInput = {
        actorUserId: ids.appAdmin,
        clubId: ids.club,
        operationId: transferOperationId,
        previousAdminNextRole: 'MEMBER' as const,
        targetMembershipId: ids.moderatorMembership,
    };
    const transfer = await transitions.transferAdministration(transferInput);
    const transferRetry = await transitions.transferAdministration({
        ...transferInput,
        actorUserId: transferInput.actorUserId.toUpperCase(),
        clubId: transferInput.clubId.toUpperCase(),
        operationId: transferInput.operationId.toUpperCase(),
        targetMembershipId: transferInput.targetMembershipId.toUpperCase(),
    });
    if (
        !transfer.changed ||
        transfer.replayed ||
        !transferRetry.changed ||
        !transferRetry.replayed ||
        transfer.auditEventId !== transferRetry.auditEventId
    ) {
        throw new Error(
            'Administration transfer retry did not return the original audited result.',
        );
    }
    const activeAdmins = await database.membership.findMany({
        where: { clubId: ids.club, role: 'ADMIN', status: 'ACTIVE' },
        select: { userId: true },
    });
    if (activeAdmins.length !== 1 || activeAdmins[0]?.userId !== ids.moderator) {
        throw new Error('Administration transfer did not leave exactly the intended active Admin.');
    }
    const transferAudit = await database.clubAuditEvent.findUnique({
        where: { operationId: transferOperationId },
    });
    if (
        transferAudit?.action !== 'ADMIN_TRANSFERRED' ||
        transferAudit.previousAdminUserId !== ids.admin ||
        transferAudit.previousAdminNextRole !== 'MEMBER'
    ) {
        throw new Error('Administration transfer audit record is incomplete.');
    }
}
