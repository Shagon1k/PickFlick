import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

import { createDatabaseClient, type PrismaClient } from '@pickflick/database';
import { z } from 'zod';

import {
    addMember,
    createSession,
    createUser,
    loadIntegrationEnvironment,
} from '../../../testing/integration.js';
import { removeUsers } from '../../../testing/remove-users.js';
import { buildArchive } from '../archive.js';

const archiveSchema = z.object({
    manifest: z.object({
        version: z.literal(1),
        exclusions: z.array(z.string()),
        providers: z.array(z.string()),
        sections: z.array(
            z.object({ name: z.string(), sha256: z.string(), fields: z.array(z.string()) }),
        ),
    }),
    data: z.record(z.string(), z.unknown()),
});

describe('buildArchive', () => {
    let prisma: PrismaClient;
    let owner: string;
    let peer: string;
    let movieId: string;
    let clubId: string;
    let sessionId: string;
    let avatarKey: string;
    const avatarBytes = Buffer.from('synthetic-current-avatar');
    const get = vi.fn<() => Promise<{ body: Buffer; contentType: string } | null>>();

    beforeAll(async () => {
        prisma = createDatabaseClient(loadIntegrationEnvironment().databaseUrl);
        [owner, peer] = await Promise.all([createUser(prisma), createUser(prisma)]);
        await prisma.user.update({
            where: { id: peer },
            data: { displayName: 'EXCLUDED_PEER_NAME' },
        });
        avatarKey = `account-avatars/${randomUUID()}`;
        await prisma.accountAvatarObject.create({ data: { key: avatarKey } });
        await prisma.user.update({
            where: { id: owner },
            data: {
                avatarObjectKey: avatarKey,
                image: 'https://lh3.googleusercontent.com/EXCLUDED_PROVIDER_PHOTO',
            },
        });
        await prisma.providerAccount.create({
            data: {
                userId: owner,
                provider: 'google',
                providerSubject: 'own-provider-subject',
                accessToken: 'EXCLUDED_ACCESS_TOKEN',
                refreshToken: 'EXCLUDED_REFRESH_TOKEN',
                idToken: 'EXCLUDED_ID_TOKEN',
                password: 'EXCLUDED_PASSWORD',
            },
        });
        await prisma.authSession.create({
            data: {
                userId: owner,
                token: 'EXCLUDED_SESSION_TOKEN',
                expiresAt: new Date(Date.now() + 60_000),
                ipAddress: '192.0.2.1',
                userAgent: 'Own test browser',
            },
        });
        const movie = await prisma.movie.create({ data: { title: 'Archive test movie' } });
        movieId = movie.id;
        clubId = randomUUID();
        await prisma.club.create({ data: { id: clubId, name: 'EXCLUDED_SHARED_NAME' } });
        const ownerMembership = await addMember(prisma, clubId, owner, 'ADMIN');
        const peerMembership = await addMember(prisma, clubId, peer);
        const session = await createSession(prisma, clubId, {
            type: 'FULL_CYCLE',
            phase: 'RATING',
            notes: 'EXCLUDED_SHARED_NOTES',
            selectionResult: { name: 'EXCLUDED_SNAPSHOT', peer },
        });
        sessionId = session.id;
        const ownParticipant = await prisma.sessionParticipant.create({
            data: {
                sessionId,
                clubId,
                membershipId: ownerMembership,
                status: 'ACCEPTED',
                attended: true,
            },
        });
        const peerParticipant = await prisma.sessionParticipant.create({
            data: { sessionId, clubId, membershipId: peerMembership, status: 'ACCEPTED' },
        });
        const ownNomination = await prisma.nomination.create({
            data: { sessionId, participantId: ownParticipant.id, movieId },
        });
        const peerNomination = await prisma.nomination.create({
            data: { sessionId, participantId: peerParticipant.id, movieId },
        });
        for (const participantId of [ownParticipant.id, peerParticipant.id]) {
            const ballot = await prisma.selectionBallot.create({
                data: {
                    sessionId,
                    participantId,
                },
            });
            await prisma.selectionScore.create({
                data: {
                    ballotId: ballot.id,
                    sessionId,
                    nominationId:
                        participantId === ownParticipant.id ? peerNomination.id : ownNomination.id,
                    score: participantId === ownParticipant.id ? 4 : 2,
                },
            });
            await prisma.sessionRating.create({
                data: {
                    sessionId,
                    participantId,
                    score: participantId === ownParticipant.id ? 8 : 2,
                    comment:
                        participantId === ownParticipant.id
                            ? 'Own comment'
                            : 'EXCLUDED_PEER_COMMENT',
                },
            });
        }
        const past = await createSession(prisma, clubId, { type: 'PAST', phase: 'COMPLETED' });
        const pastParticipant = await prisma.sessionParticipant.create({
            data: { sessionId: past.id, clubId, membershipId: ownerMembership, status: 'ACCEPTED' },
        });
        const pastNomination = await prisma.pastNomination.create({
            data: { sessionId: past.id, movieId, nominatorMembershipId: ownerMembership },
        });
        await prisma.pastSelectionScore.create({
            data: {
                sessionId: past.id,
                nominationId: pastNomination.id,
                participantId: pastParticipant.id,
                score: 3,
            },
        });
        await prisma.personalMovieRating.createMany({
            data: [
                { userId: owner, movieId, score: 9, source: 'PERSONAL' },
                { userId: peer, movieId, score: 1, source: 'PERSONAL' },
            ],
        });
        await prisma.watchlistItem.create({ data: { userId: owner, movieId, priority: 'HIGH' } });
        await prisma.achievementAward.create({
            data: {
                key: 'own-award',
                version: 1,
                userId: owner,
                private: true,
                title: 'Own award',
                description: 'Own progress',
                target: 1,
                progress: 1,
                explanation: 'EXCLUDED_EXPLANATION',
                evidence: { peer: 'EXCLUDED_EVIDENCE' },
            },
        });
        const notification = await prisma.notification.create({
            data: {
                recipientId: owner,
                event: 'BILLING_SERVICE',
                sourceId: randomUUID(),
                inApp: true,
                email: true,
            },
        });
        await prisma.notificationEmailDelivery.create({
            data: {
                notificationId: notification.id,
                status: 'DELIVERED',
                recipientHash: 'EXCLUDED_ADDRESS_HASH',
                providerId: 'EXCLUDED_DELIVERY_ID',
                reason: 'EXCLUDED_DELIVERY_REASON',
            },
        });
        await prisma.notificationPreference.create({
            data: { userId: owner, event: 'BILLING_SERVICE', inApp: true, email: true },
        });
        await prisma.clubInvite.create({
            data: {
                clubId,
                inviterId: owner,
                targetUserId: peer,
                tokenDigest: 'a'.repeat(64),
                expiresAt: new Date(Date.now() + 60_000),
            },
        });
        await prisma.clubInvite.create({
            data: {
                clubId,
                inviterId: peer,
                targetUserId: owner,
                responderId: owner,
                accepted: true,
                respondedAt: new Date(),
                tokenDigest: 'b'.repeat(64),
                expiresAt: new Date(Date.now() + 60_000),
            },
        });
        await prisma.clubAuditEvent.create({
            data: {
                id: randomUUID(),
                clubId,
                actorUserId: owner,
                subjectUserId: peer,
                subjectMembershipId: peerMembership,
                action: 'MEMBERSHIP_ROLE_CHANGED',
                changed: false,
                previousRole: 'MEMBER',
                nextRole: 'MEMBER',
            },
        });
        await prisma.clubAuditEvent.create({
            data: {
                id: randomUUID(),
                clubId,
                actorUserId: peer,
                subjectUserId: owner,
                subjectMembershipId: ownerMembership,
                action: 'MEMBERSHIP_ROLE_CHANGED',
                changed: false,
                previousRole: 'ADMIN',
                nextRole: 'ADMIN',
            },
        });
    });
    beforeEach(() => {
        get.mockReset().mockResolvedValue({ body: avatarBytes, contentType: 'image/webp' });
    });
    afterAll(async () => {
        await removeUsers(prisma, [owner, peer]);
        await prisma.accountAvatarObject.delete({ where: { key: avatarKey } });
        await prisma.movie.delete({ where: { id: movieId } });
        await prisma.$disconnect();
    });

    it('should include the own inventory with a verifiable manifest and no peer data or credentials', async () => {
        const body = await buildArchive(prisma, { get }, owner);
        const raw = gunzipSync(body).toString('utf8');
        const archive = archiveSchema.parse(JSON.parse(raw));
        expect(raw).not.toMatch(/EXCLUDED_/u);
        expect(raw).not.toContain(peer);
        expect(raw).not.toContain(avatarKey);
        expect(raw).not.toContain('a'.repeat(64));
        expect(archive.data).toMatchObject({
            profile: { id: owner, displayName: 'Test User' },
            providers: [{ provider: 'google', providerSubject: 'own-provider-subject' }],
            authSessions: [{ ipAddress: '192.0.2.1', userAgent: 'Own test browser' }],
            personalRatings: [{ movieId, score: 9, source: 'PERSONAL' }],
            watchlist: [{ movieId, priority: 'HIGH' }],
            memberships: [{ clubId, role: 'ADMIN' }],
            participation: expect.arrayContaining([
                expect.objectContaining({ sessionId, attended: true }),
            ]),
            nominations: [{ sessionId, movieId }],
            ballots: [{ sessionId, scores: [{ score: 4 }] }],
            pastNominations: [{ movieId }],
            pastScores: [{ score: 3 }],
            sessionRatings: [{ sessionId, score: 8, comment: 'Own comment' }],
            achievements: [{ key: 'own-award', private: true }],
            notifications: [{ event: 'BILLING_SERVICE', emailDelivery: { status: 'DELIVERED' } }],
            notificationPreferences: [{ event: 'BILLING_SERVICE', inApp: true, email: true }],
            invitations: expect.arrayContaining([expect.objectContaining({ clubId })]),
            invitationResponses: [{ clubId, accepted: true }],
            auditEvents: expect.arrayContaining([
                expect.objectContaining({ clubId, action: 'MEMBERSHIP_ROLE_CHANGED' }),
            ]),
            roleChanges: [{ clubId, previousRole: 'ADMIN', nextRole: 'ADMIN' }],
            avatar: { contentType: 'image/webp', base64: avatarBytes.toString('base64') },
        });
        expect(
            archive.manifest.sections.map(({ name }) => name).sort((a, b) => a.localeCompare(b)),
        ).toEqual(Object.keys(archive.data).sort((a, b) => a.localeCompare(b)));
        for (const section of archive.manifest.sections) {
            expect(section.sha256).toBe(
                createHash('sha256')
                    .update(JSON.stringify(archive.data[section.name]))
                    .digest('hex'),
            );
        }
        expect(archive.manifest.exclusions.join(' ')).toMatch(/snapshots.*provider.*backup/iu);
        expect(archive.manifest.providers.join(' ')).toContain('Resend');
        expect(get).toHaveBeenCalledWith(avatarKey, expect.any(AbortSignal));
    });

    it('should fail visibly instead of publishing an archive missing a current uploaded avatar', async () => {
        get.mockResolvedValue(null);
        await expect(buildArchive(prisma, { get }, owner)).rejects.toThrow(
            'Current avatar unavailable',
        );
    });
});
