import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { assertSafeSeedOrResetTarget } from '@pickflick/database';
import { createLogger } from '@pickflick/observability';

import { ClubAvatarStorage } from '../../src/clubs/club-avatar.storage.js';
import { PrismaClubManagementRepository } from '../../src/clubs/club-management.repository.js';
import { ClubManagementService } from '../../src/clubs/club-management.service.js';
import { ClubOnboardingService } from '../../src/clubs/club-onboarding.service.js';
import { ClubPolicyService } from '../../src/clubs/club-policy.service.js';
import { PrismaClubRepository } from '../../src/clubs/club.repository.js';
import { PrismaClubRoleRepository } from '../../src/clubs/club-role.repository.js';
import { ClubRoleTransitionService } from '../../src/clubs/club-role-transition.service.js';
import { StaticClubTierResolver } from '../../src/clubs/club-tiers.js';
import { DatabaseService } from '../../src/database/database.service.js';

export const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
export const databaseService = new DatabaseService(environment);
export const database = databaseService.client;
export const repository = new PrismaClubRepository(databaseService);
export const managementRepository = new PrismaClubManagementRepository(databaseService);

export class CheckAvatarStorage extends ClubAvatarStorage {
    readonly objects = new Map<string, { body: Buffer; contentType: string }>();
    async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
        this.objects.set(objectKey, { body, contentType });
    }
    async get(objectKey: string) {
        return this.objects.get(objectKey);
    }
    async delete(objectKey: string): Promise<void> {
        this.objects.delete(objectKey);
    }
}

export let logOutput = '';
export const logger = createLogger({
    environment: 'test',
    service: 'api',
    destination: new Writable({
        write(chunk, _encoding, callback) {
            logOutput += chunk.toString();
            callback();
        },
    }),
});
export const policy = new ClubPolicyService(repository, new StaticClubTierResolver());
export const onboarding = new ClubOnboardingService(
    repository,
    new StaticClubTierResolver(),
    logger,
);
export const transitions = new ClubRoleTransitionService(
    new PrismaClubRoleRepository(databaseService),
    logger,
);
export const avatarStorage = new CheckAvatarStorage();
export const management = new ClubManagementService(
    managementRepository,
    transitions,
    new StaticClubTierResolver(),
    avatarStorage,
    logger,
);

export const ids = {
    club: randomUUID(),
    admin: randomUUID(),
    appAdmin: randomUUID(),
    moderator: randomUUID(),
    member: randomUUID(),
    outsider: randomUUID(),
    creator: randomUUID(),
    reactivationAdmin: randomUUID(),
    suspended: randomUUID(),
    anonymized: randomUUID(),
    adminMembership: randomUUID(),
    moderatorMembership: randomUUID(),
    memberMembership: randomUUID(),
    suspendedMembership: randomUUID(),
    anonymizedMembership: randomUUID(),
    adminlessClub: randomUUID(),
    adminlessMembership: randomUUID(),
    reactivationClub: randomUUID(),
    reactivationMembership: randomUUID(),
    historicalSession: randomUUID(),
};

export const createdClubIds: { created?: string | undefined; reactivation?: string | undefined } =
    {};

export function principal(userId: string) {
    return { appRole: 'USER' as const, sessionId: randomUUID(), userId };
}

/** Security logs must never carry a Club, User, or Membership identifier. */
export function assertLogsExposeNoIdentifiers(): void {
    if (
        logOutput.includes(ids.club) ||
        logOutput.includes(ids.admin) ||
        logOutput.includes(ids.appAdmin) ||
        logOutput.includes(ids.moderator) ||
        logOutput.includes(ids.member)
    ) {
        throw new Error('Club security logs exposed a Club, User, or Membership identifier.');
    }
}

/** Removes every Club, Membership, audit event, and User this run created. */
export async function cleanUpClubCheck(): Promise<void> {
    if (createdClubIds.reactivation) {
        await database.clubAuditEvent.deleteMany({
            where: { clubId: createdClubIds.reactivation },
        });
        await database.membership.deleteMany({
            where: { clubId: createdClubIds.reactivation },
        });
        await database.club.deleteMany({ where: { id: createdClubIds.reactivation } });
    }
    await database.clubAuditEvent.deleteMany({ where: { clubId: ids.reactivationClub } });
    await database.membership.deleteMany({ where: { clubId: ids.reactivationClub } });
    await database.club.deleteMany({ where: { id: ids.reactivationClub } });
    if (createdClubIds.created) {
        await database.clubAuditEvent.deleteMany({ where: { clubId: createdClubIds.created } });
        await database.membership.deleteMany({ where: { clubId: createdClubIds.created } });
        await database.club.deleteMany({ where: { id: createdClubIds.created } });
    }
    await database.clubAuditEvent.deleteMany({ where: { clubId: ids.adminlessClub } });
    await database.membership.deleteMany({ where: { clubId: ids.adminlessClub } });
    await database.club.deleteMany({ where: { id: ids.adminlessClub } });
    await database.clubAuditEvent.deleteMany({ where: { clubId: ids.club } });
    await database.session.deleteMany({ where: { clubId: ids.club } });
    await database.membership.deleteMany({ where: { clubId: ids.club } });
    await database.club.deleteMany({ where: { id: ids.club } });
    await database.user.deleteMany({
        where: {
            id: {
                in: [
                    ids.admin,
                    ids.appAdmin,
                    ids.moderator,
                    ids.member,
                    ids.outsider,
                    ids.creator,
                    ids.reactivationAdmin,
                    ids.suspended,
                    ids.anonymized,
                ],
            },
        },
    });
    await databaseService.onModuleDestroy();
}
