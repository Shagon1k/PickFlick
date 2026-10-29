import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { createDatabaseClient } from '../client.js';
import { SYNTHETIC_FIXTURES } from '../fixtures.js';
import type { Prisma } from '../generated/prisma/client.js';
import { assertSafeSeedOrResetTarget } from '../safety.js';
import { snapshotSessionSettings } from '../session.js';

// Runs against the migrated and seeded local or test database. Every probe rolls back.
const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const database = createDatabaseClient(environment.databaseUrl);

class RollbackProbe extends Error {}

async function runRollbackProbe(
    action: (transaction: Prisma.TransactionClient) => Promise<unknown>,
): Promise<void> {
    try {
        await database.$transaction(async (transaction) => {
            await action(transaction);
            throw new RollbackProbe();
        });
    } catch (error) {
        if (!(error instanceof RollbackProbe)) {
            throw error;
        }
    }
}

async function expectAccepted(
    action: (transaction: Prisma.TransactionClient) => Promise<unknown>,
): Promise<void> {
    await expect(runRollbackProbe(action)).resolves.toBeUndefined();
}

async function expectConstraint(
    action: (transaction: Prisma.TransactionClient) => Promise<unknown>,
    name: string,
): Promise<void> {
    await expect(runRollbackProbe(action)).rejects.toThrow(name);
}

describe('database constraints', () => {
    afterAll(async () => {
        await database.$disconnect();
    });

    it('should hold the deterministic synthetic fixtures', async () => {
        const fixtureCount = await database.user.count({
            where: { id: { in: SYNTHETIC_FIXTURES.users.map(({ id }) => id) } },
        });
        const pastSession = await database.session.findUnique({
            where: { id: SYNTHETIC_FIXTURES.pastSession.id },
            select: { type: true, phase: true },
        });

        expect(fixtureCount).toBe(SYNTHETIC_FIXTURES.users.length);
        expect(pastSession).toEqual({ type: 'PAST', phase: 'COMPLETED' });
    });

    it('should reject a write that breaks User_email_normalized_key', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.user.create({
                    data: {
                        id: '60000000-0000-4000-8000-000000000005',
                        displayName: 'Case Collision',
                        email: SYNTHETIC_FIXTURES.users[0].email.toUpperCase(),
                    },
                }),
            'User_email_normalized_key',
        );
    });

    it('should reject a write that breaks Session_one_blocking_per_club_key', async () => {
        await expectConstraint(async (transaction) => {
            await transaction.session.create({
                data: {
                    id: '40000000-0000-4000-8000-000000000001',
                    clubId: SYNTHETIC_FIXTURES.club.id,
                    ...(await snapshotSessionSettings(transaction, SYNTHETIC_FIXTURES.club.id)),
                    type: 'FULL_CYCLE',
                    phase: 'NOMINATION',
                },
            });
            await transaction.session.create({
                data: {
                    id: '40000000-0000-4000-8000-000000000002',
                    clubId: SYNTHETIC_FIXTURES.club.id,
                    ...(await snapshotSessionSettings(transaction, SYNTHETIC_FIXTURES.club.id)),
                    type: 'PRE_SELECTED',
                    phase: 'WATCHING',
                },
            });
        }, 'Session_one_blocking_per_club_key');
    });

    it('should allow several completed Past Sessions in one Club', async () => {
        await expectAccepted(async (transaction) =>
            transaction.session.createMany({
                data: [
                    {
                        id: '40000000-0000-4000-8000-000000000003',
                        clubId: SYNTHETIC_FIXTURES.club.id,
                        ...(await snapshotSessionSettings(transaction, SYNTHETIC_FIXTURES.club.id)),
                        type: 'PAST',
                        phase: 'COMPLETED',
                    },
                    {
                        id: '40000000-0000-4000-8000-000000000004',
                        clubId: SYNTHETIC_FIXTURES.club.id,
                        ...(await snapshotSessionSettings(transaction, SYNTHETIC_FIXTURES.club.id)),
                        type: 'PAST',
                        phase: 'COMPLETED',
                    },
                ],
            }),
        );
    });

    it('should reject a write that breaks Club_selection_scale_check', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.club.update({
                    where: { id: SYNTHETIC_FIXTURES.club.id },
                    data: { selectionScaleMax: 11 },
                }),
            'Club_selection_scale_check',
        );
    });

    it('should reject a write that breaks Club_deleted_lifecycle_check', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.club.update({
                    where: { id: SYNTHETIC_FIXTURES.club.id },
                    data: { deletedAt: new Date() },
                }),
            'Club_deleted_lifecycle_check',
        );
    });

    it('should reject a write that breaks Membership_one_active_admin_per_club_key', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.membership.update({
                    where: { id: SYNTHETIC_FIXTURES.memberships.member },
                    data: { role: 'ADMIN' },
                }),
            'Membership_one_active_admin_per_club_key',
        );
    });

    it('should reject a write that breaks Membership_one_active_per_user_club_key', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.membership.create({
                    data: {
                        id: '40000000-0000-4000-8000-000000000005',
                        clubId: SYNTHETIC_FIXTURES.club.id,
                        userId: SYNTHETIC_FIXTURES.users[1].id,
                        role: 'MEMBER',
                    },
                }),
            'Membership_one_active_per_user_club_key',
        );
    });

    it('should allow a departed Member to rejoin the Club', async () => {
        await expectAccepted(async (transaction) => {
            await transaction.membership.update({
                where: { id: SYNTHETIC_FIXTURES.memberships.member },
                data: { status: 'LEFT', leftAt: new Date() },
            });
            await transaction.membership.create({
                data: {
                    id: '40000000-0000-4000-8000-000000000006',
                    clubId: SYNTHETIC_FIXTURES.club.id,
                    userId: SYNTHETIC_FIXTURES.users[1].id,
                    role: 'MEMBER',
                },
            });
        });
    });

    it('should reject a write that breaks Membership_status_departure_check', async () => {
        await expectConstraint(
            (transaction) =>
                transaction.membership.update({
                    where: { id: SYNTHETIC_FIXTURES.memberships.member },
                    data: { status: 'LEFT', leftAt: null },
                }),
            'Membership_status_departure_check',
        );
    });

    it('should allow an adminless Club', async () => {
        await expectAccepted((transaction) =>
            transaction.membership.update({
                where: { id: SYNTHETIC_FIXTURES.memberships.admin },
                data: { role: 'MODERATOR' },
            }),
        );
    });

    it('should reject a write that breaks ProviderAccount_provider_providerSubject_key', async () => {
        await expectConstraint(async (transaction) => {
            await transaction.providerAccount.createMany({
                data: [
                    {
                        id: '60000000-0000-4000-8000-000000000001',
                        provider: 'google',
                        providerSubject: 'same-google-subject',
                        userId: SYNTHETIC_FIXTURES.users[0].id,
                    },
                    {
                        id: '60000000-0000-4000-8000-000000000002',
                        provider: 'google',
                        providerSubject: 'same-google-subject',
                        userId: SYNTHETIC_FIXTURES.users[1].id,
                    },
                ],
            });
        }, 'ProviderAccount_provider_providerSubject_key');
    });

    it('should reject a write that breaks AuthSession_token_key', async () => {
        await expectConstraint(async (transaction) => {
            await transaction.authSession.createMany({
                data: [
                    {
                        id: '60000000-0000-4000-8000-000000000003',
                        expiresAt: new Date(Date.now() + 60_000),
                        token: 'duplicate-opaque-session-token',
                        userId: SYNTHETIC_FIXTURES.users[0].id,
                    },
                    {
                        id: '60000000-0000-4000-8000-000000000004',
                        expiresAt: new Date(Date.now() + 60_000),
                        token: 'duplicate-opaque-session-token',
                        userId: SYNTHETIC_FIXTURES.users[1].id,
                    },
                ],
            });
        }, 'AuthSession_token_key');
    });

    const probeAward = (owner: { userId?: string; clubId?: string }) => ({
        key: 'constraint-probe',
        version: 1,
        title: 'Probe',
        description: 'Probe',
        explanation: 'Probe',
        target: 1,
        progress: 1,
        evidence: {},
        ...owner,
    });

    it.each([{}, { userId: SYNTHETIC_FIXTURES.users[0].id, clubId: SYNTHETIC_FIXTURES.club.id }])(
        'should reject an achievement award without exactly one owner: %j',
        async (owner) => {
            await expectConstraint(
                (transaction) => transaction.achievementAward.create({ data: probeAward(owner) }),
                'AchievementAward_check',
            );
        },
    );

    it.each([
        [{ userId: SYNTHETIC_FIXTURES.users[0].id }, 'AchievementAward_key_version_userId_key'],
        [{ clubId: SYNTHETIC_FIXTURES.club.id }, 'AchievementAward_key_version_clubId_key'],
    ])('should award each key and version once per owner: %j', async (owner, constraint) => {
        await expectConstraint(
            (transaction) =>
                transaction.achievementAward.createMany({
                    data: [probeAward(owner), probeAward(owner)],
                }),
            constraint,
        );
    });
});
