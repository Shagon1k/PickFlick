import { database, ids } from './harness.js';

export async function seedClubFixtures() {
    await database.$transaction(async (transaction) => {
        await transaction.user.createMany({
            data: [
                { id: ids.admin, email: `${ids.admin}@example.invalid`, displayName: 'Club Admin' },
                {
                    id: ids.appAdmin,
                    email: `${ids.appAdmin}@example.invalid`,
                    displayName: 'App Admin',
                    appRole: 'APP_ADMIN',
                },
                {
                    id: ids.moderator,
                    email: `${ids.moderator}@example.invalid`,
                    displayName: 'Club Moderator',
                },
                {
                    id: ids.member,
                    email: `${ids.member}@example.invalid`,
                    displayName: 'Club Member',
                },
                {
                    id: ids.outsider,
                    email: `${ids.outsider}@example.invalid`,
                    displayName: 'Non-member',
                },
                {
                    id: ids.creator,
                    email: `${ids.creator}@example.invalid`,
                    displayName: 'First Club Creator',
                },
                {
                    id: ids.reactivationAdmin,
                    email: `${ids.reactivationAdmin}@example.invalid`,
                    displayName: 'Reactivation Admin',
                },
                {
                    id: ids.suspended,
                    email: `${ids.suspended}@example.invalid`,
                    displayName: 'Suspended Admin',
                    status: 'SUSPENDED',
                },
                {
                    id: ids.anonymized,
                    email: `${ids.anonymized}@example.invalid`,
                    displayName: 'Anonymized Member',
                    status: 'ANONYMIZED',
                },
            ],
        });
        await transaction.club.create({ data: { id: ids.club, name: 'Club boundary check' } });
        await transaction.club.create({
            data: { id: ids.adminlessClub, name: 'Adminless boundary check' },
        });
        await transaction.club.create({
            data: { id: ids.reactivationClub, lifecycle: 'ARCHIVED', name: 'Archived limit check' },
        });
        await transaction.membership.createMany({
            data: [
                { id: ids.adminMembership, clubId: ids.club, userId: ids.admin, role: 'ADMIN' },
                {
                    id: ids.moderatorMembership,
                    clubId: ids.club,
                    userId: ids.moderator,
                    role: 'MODERATOR',
                },
                { id: ids.memberMembership, clubId: ids.club, userId: ids.member, role: 'MEMBER' },
                {
                    id: ids.suspendedMembership,
                    clubId: ids.club,
                    userId: ids.suspended,
                    role: 'MODERATOR',
                },
                {
                    id: ids.anonymizedMembership,
                    clubId: ids.club,
                    userId: ids.anonymized,
                    role: 'MEMBER',
                },
                {
                    id: ids.adminlessMembership,
                    clubId: ids.adminlessClub,
                    userId: ids.member,
                    role: 'MEMBER',
                },
                {
                    id: ids.reactivationMembership,
                    clubId: ids.reactivationClub,
                    userId: ids.reactivationAdmin,
                    role: 'ADMIN',
                },
            ],
            skipDuplicates: true,
        });
        await transaction.session.create({
            data: { id: ids.historicalSession, clubId: ids.club, type: 'PAST', phase: 'COMPLETED' },
        });
    });
}
