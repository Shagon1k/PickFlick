import { randomUUID } from 'node:crypto';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { createDatabaseClient } from '../client.js';
import type { Prisma, SessionPhase } from '../generated/prisma/client.js';
import { assertSafeSeedOrResetTarget } from '../safety.js';
import { snapshotSessionSettings } from '../session.js';

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const database = createDatabaseClient(environment.databaseUrl);

// Each test owns its records; no fixtures or pre-existing history are changed.
describe('Session foundation', () => {
    let clubId: string;
    let otherClubId: string;
    let membershipId: string;
    let otherMembershipId: string;
    let userId: string;

    beforeEach(async () => {
        clubId = randomUUID();
        otherClubId = randomUUID();
        membershipId = randomUUID();
        otherMembershipId = randomUUID();
        userId = randomUUID();
        await database.user.create({
            data: { id: userId, displayName: 'Session test', email: `${userId}@example.invalid` },
        });
        for (const [id, memberId] of [
            [clubId, membershipId],
            [otherClubId, otherMembershipId],
        ] as const) {
            await database.club.create({
                data: {
                    id,
                    name: 'Session foundation test',
                    selectionScaleMin: 0,
                    selectionScaleMax: 10,
                    memberships: { create: { id: memberId, userId, role: 'ADMIN' } },
                },
            });
        }
    });
    afterEach(async () => {
        const clubs = { clubId: { in: [clubId, otherClubId] } };
        await database.sessionInvite.deleteMany({ where: clubs });
        await database.sessionParticipant.deleteMany({ where: clubs });
        await database.session.deleteMany({ where: clubs });
        await database.membership.deleteMany({ where: clubs });
        await database.club.deleteMany({ where: { id: { in: [clubId, otherClubId] } } });
        await database.user.delete({ where: { id: userId } });
    });
    afterAll(async () => {
        await database.$disconnect();
    });

    const createSession = (phase: SessionPhase, id = randomUUID()) =>
        database.$transaction(async (transaction) =>
            transaction.session.create({
                data: {
                    id,
                    clubId,
                    type: 'FULL_CYCLE',
                    phase,
                    ...(await snapshotSessionSettings(transaction, clubId)),
                },
            }),
        );

    it.each(['NOMINATION', 'SELECTION', 'WATCHING'] as const)(
        'should permit only one concurrent blocking creation in %s',
        async (phase) => {
            const results = await Promise.allSettled([createSession(phase), createSession(phase)]);
            expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
            expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
                reason: { code: 'P2002' },
            });
            expect(await database.session.count({ where: { clubId } })).toBe(1);
        },
    );

    it('should enforce the index even when callers do not take the Club lock', async () => {
        const settings = await snapshotSessionSettings(database, clubId);
        const create = (phase: SessionPhase) =>
            database.$transaction((transaction) =>
                transaction.session.create({
                    data: { ...settings, id: randomUUID(), clubId, type: 'FULL_CYCLE', phase },
                }),
            );
        const results = await Promise.allSettled([create('NOMINATION'), create('WATCHING')]);
        expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
        expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
            reason: { code: 'P2002' },
        });
    });

    it('should permit concurrent Rating Sessions and release the blocking slot on Rating', async () => {
        const blocking = await createSession('WATCHING');
        await Promise.all(Array.from({ length: 6 }, () => createSession('RATING')));
        await database.session.update({
            where: { id: blocking.id },
            data: { phase: 'RATING', phaseVersion: { increment: 1 } },
        });
        const next = await createSession('NOMINATION');
        expect(next.phase).toBe('NOMINATION');
        expect(await database.session.count({ where: { clubId, phase: 'RATING' } })).toBe(7);
    });

    it('should reject concurrent transitions of two Rating Sessions into blocking phases', async () => {
        const first = await createSession('RATING');
        const second = await createSession('RATING');
        const transition = (id: string) =>
            database.$transaction((transaction) =>
                transaction.session.update({
                    where: { id },
                    data: { phase: 'WATCHING', phaseVersion: { increment: 1 } },
                }),
            );
        const results = await Promise.allSettled([transition(first.id), transition(second.id)]);
        expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
        expect(await database.session.count({ where: { clubId, phase: 'RATING' } })).toBe(1);
        expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
            reason: { code: 'P2002' },
        });
    });

    it.each([0, 1])(
        'should preserve the %i-based score and visibility snapshot after Club edits',
        async (min) => {
            await database.club.update({ where: { id: clubId }, data: { selectionScaleMin: min } });
            const session = await createSession('NOMINATION');
            await database.club.update({
                where: { id: clubId },
                data: {
                    selectionScaleMin: 1,
                    selectionScaleMax: 5,
                    showNominationAuthors: false,
                    showNominationsBeforeSubmit: false,
                    showVoteResults: true,
                    showRatingResults: false,
                    useMonochromeMedia: false,
                },
            });
            const saved = await database.session.findUniqueOrThrow({ where: { id: session.id } });
            expect(saved).toMatchObject({
                selectionScaleMin: min,
                selectionScaleMax: 10,
                showNominationAuthors: true,
                showNominationsBeforeSubmit: true,
                showVoteResults: false,
                showRatingResults: true,
                useMonochromeMedia: true,
            });
            const later = await createSession('RATING');
            expect(later).toMatchObject({
                selectionScaleMin: 1,
                selectionScaleMax: 5,
                showNominationAuthors: false,
                showVoteResults: true,
            });
        },
    );

    it('should reject invalid score snapshots and nonpositive versions', async () => {
        const session = await createSession('RATING');
        for (const data of [
            { selectionScaleMax: 11 },
            { selectionScaleMin: 1, selectionScaleMax: 1 },
            { phaseVersion: 0 },
        ]) {
            await expect(
                database.session.update({ where: { id: session.id }, data }),
            ).rejects.toThrow();
        }
    });

    it('should count only accepted participants while preserving attendance', async () => {
        const session = await createSession('NOMINATION');
        const participant = await database.sessionParticipant.create({
            data: { sessionId: session.id, clubId, membershipId },
        });
        const accepted = () =>
            database.sessionParticipant.count({
                where: { sessionId: session.id, status: 'ACCEPTED' },
            });
        expect(await accepted()).toBe(0);
        await database.sessionParticipant.update({
            where: { id: participant.id },
            data: { status: 'ACCEPTED', attended: true },
        });
        expect(await accepted()).toBe(1);
        await database.sessionParticipant.update({
            where: { id: participant.id },
            data: { status: 'LEFT' },
        });
        expect(await accepted()).toBe(0);
        expect(
            await database.sessionParticipant.findUnique({ where: { id: participant.id } }),
        ).toMatchObject({ attended: true });
    });

    it('should roll back a failed roster write and reject duplicate or moved identities', async () => {
        const session = await createSession('NOMINATION');
        const data = { sessionId: session.id, clubId, membershipId, status: 'ACCEPTED' as const };
        const participant = await database.sessionParticipant.create({ data });
        await expect(database.sessionParticipant.create({ data })).rejects.toThrow();
        await expect(
            database.sessionParticipant.update({
                where: { id: participant.id },
                data: { membershipId: otherMembershipId },
            }),
        ).rejects.toThrow();
        const abort = async (transaction: Prisma.TransactionClient) => {
            await transaction.sessionParticipant.update({
                where: { id: participant.id },
                data: { status: 'REMOVED' },
            });
            throw new Error('abort roster test');
        };
        await expect(database.$transaction(abort)).rejects.toThrow('abort roster test');
        expect(
            await database.sessionParticipant.findUnique({ where: { id: participant.id } }),
        ).toMatchObject({ status: 'ACCEPTED' });
    });

    it('should bind invite recipients and inviters to existing Memberships in the Session Club', async () => {
        const session = await createSession('NOMINATION');
        await expect(
            database.sessionParticipant.create({
                data: { sessionId: session.id, clubId, membershipId: otherMembershipId },
            }),
        ).rejects.toThrow();
        const participant = await database.sessionParticipant.create({
            data: { sessionId: session.id, clubId, membershipId },
        });
        const invite = {
            participantId: participant.id,
            clubId,
            inviterMembershipId: membershipId,
            tokenDigest: 'a'.repeat(64),
            expiresAt: new Date(Date.now() + 60_000),
        };
        await database.sessionInvite.create({ data: invite });
        await expect(database.sessionInvite.create({ data: invite })).rejects.toThrow();
        await expect(
            database.sessionInvite.create({
                data: {
                    ...invite,
                    tokenDigest: 'b'.repeat(64),
                    inviterMembershipId: otherMembershipId,
                },
            }),
        ).rejects.toThrow();
        await expect(
            database.sessionInvite.create({ data: { ...invite, tokenDigest: 'raw-token' } }),
        ).rejects.toThrow();
        await expect(
            database.sessionInvite.create({
                data: { ...invite, tokenDigest: 'c'.repeat(64), expiresAt: new Date(0) },
            }),
        ).rejects.toThrow();
        await expect(
            database.sessionInvite.create({
                data: { ...invite, tokenDigest: 'd'.repeat(64), accepted: true },
            }),
        ).rejects.toThrow();
        expect(await database.membership.count({ where: { clubId } })).toBe(1);
    });
});
