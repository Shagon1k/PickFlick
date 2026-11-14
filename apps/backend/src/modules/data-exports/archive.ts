import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import { appearanceSchema } from '@pickflick/contracts';
import type { Prisma, PrismaClient } from '@pickflick/database';

import type { StorageService } from '../storage/storage.service.js';
import { collectContributions } from './archive-contributions.js';

const compress = promisify(gzip);
const AVATAR_TIMEOUT_MS = 30_000;
const SNAPSHOT_TIMEOUT_MS = 60_000;

async function collectPersonalData(tx: Prisma.TransactionClient, userId: string) {
    const profile = await tx.user.findUniqueOrThrow({
        where: { id: userId, status: 'ACTIVE' },
        select: {
            id: true,
            email: true,
            emailVerified: true,
            displayName: true,
            locale: true,
            appRole: true,
            status: true,
            isAvatarRemoved: true,
            appearance: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return {
        profile: { ...profile, appearance: appearanceSchema.parse(profile.appearance) },
        providers: await tx.providerAccount.findMany({
            where: { userId },
            select: {
                provider: true,
                providerSubject: true,
                scope: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        authSessions: await tx.authSession.findMany({
            where: { userId },
            select: {
                id: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
                updatedAt: true,
                expiresAt: true,
            },
        }),
        personalRatings: await tx.personalMovieRating.findMany({
            where: { userId },
            select: { movieId: true, score: true, source: true, updatedAt: true },
        }),
        watchlist: await tx.watchlistItem.findMany({
            where: { userId },
            select: { movieId: true, priority: true, addedAt: true },
        }),
        achievements: await tx.achievementAward.findMany({
            where: { userId, clubId: null },
            select: {
                id: true,
                key: true,
                version: true,
                title: true,
                description: true,
                target: true,
                progress: true,
                private: true,
                awardedAt: true,
            },
        }),
        notifications: await tx.notification.findMany({
            where: { recipientId: userId },
            select: {
                id: true,
                event: true,
                inApp: true,
                email: true,
                readAt: true,
                createdAt: true,
                emailDelivery: {
                    select: {
                        status: true,
                        attemptCount: true,
                        firstAttemptAt: true,
                        nextAttemptAt: true,
                    },
                },
            },
        }),
        notificationPreferences: await tx.notificationPreference.findMany({
            where: { userId },
            select: { event: true, inApp: true, email: true },
        }),
        exportJobs: await tx.dataExportJob.findMany({
            where: { userId },
            select: {
                id: true,
                status: true,
                attemptCount: true,
                createdAt: true,
                completedAt: true,
                expiresAt: true,
                failure: true,
            },
        }),
    };
}

export async function buildArchive(
    prisma: PrismaClient,
    storage: Pick<StorageService, 'get'>,
    userId: string,
) {
    const snapshot = await prisma.$transaction(
        async (tx) => ({
            data: {
                ...(await collectPersonalData(tx, userId)),
                ...(await collectContributions(tx, userId)),
            },
            avatarKey: (
                await tx.user.findUniqueOrThrow({
                    where: { id: userId },
                    select: { avatarObjectKey: true },
                })
            ).avatarObjectKey,
        }),
        { isolationLevel: 'RepeatableRead', timeout: SNAPSHOT_TIMEOUT_MS },
    );
    const avatar = snapshot.avatarKey
        ? await storage.get(snapshot.avatarKey, AbortSignal.timeout(AVATAR_TIMEOUT_MS))
        : null;
    if (snapshot.avatarKey && !avatar) throw new Error('Current avatar unavailable');
    const data = {
        ...snapshot.data,
        avatar: avatar
            ? { contentType: avatar.contentType, base64: avatar.body.toString('base64') }
            : null,
    };
    const sections = Object.entries(data).map(([name, value]) => {
        const sample = Array.isArray(value) ? value[0] : value;
        return {
            name,
            sha256: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
            fields: sample ? Object.keys(sample) : [],
        };
    });
    return compress(
        JSON.stringify({
            manifest: {
                version: 1,
                generatedAt: new Date().toISOString(),
                format: 'gzip-compressed JSON; avatar bytes are base64',
                sections,
                exclusions: [
                    'Credentials, session tokens, OAuth tokens/state, passwords and signing/storage keys.',
                    'Other users identities, responses and private data; invitation secrets and peer attribution.',
                    'Club/Session free text, rosters, frozen Selection snapshots, achievement evidence/explanations and operational event payloads may contain peer data.',
                    'Only own Session Rating comments are included; shared records remain in PickFlick and are not erased by this export.',
                    'Shared catalog caches and media, Club avatars and Club achievements are not personal contributions.',
                    'Provider-hosted photos and external provider/mailbox/log/backup copies are not fetched. Uploaded current personal avatar is included.',
                    'Address hashes, abuse counters, webhook/suppression records and internal delivery IDs/reasons are excluded security/operational records.',
                    'Billing is not implemented. Job metadata retention and backup/provider policies remain subject to separate review.',
                ],
                providers: [
                    'Google OAuth; Apple remains gated. Own linked-provider subjects are included without credentials.',
                    'Hosting/PostgreSQL/private S3-compatible storage and Cloudflare process service data.',
                    'Resend and Google Workspace may hold notification/contact/support copies outside this archive.',
                    'Configured PoiskKino/TheTVDB or TMDB/media services receive server-side catalog requests; YouTube connects after Play.',
                ],
                availability:
                    'Seven days from successful generation. A download does not restart the clock.',
                scope: 'Own stored data with the listed privacy/security exclusions; not a legal-compliance certification.',
            },
            data,
        }),
    );
}
