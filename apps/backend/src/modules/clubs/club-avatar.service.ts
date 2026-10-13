import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CLUB_AVATAR_MAX_BYTES, type TClubAvatarMediaType } from '@pickflick/contracts';

import { PrismaService } from '../../database/prisma.service.js';
import { type IStoredObject, StorageService } from '../storage/storage.service.js';
import { assertActive, assertAdmin, findMembership, recordAudit } from './access/club-access.js';

const signatures: Record<
    TClubAvatarMediaType,
    { extension: string; matches: (body: Buffer) => boolean }
> = {
    'image/png': {
        extension: 'png',
        matches: (body) =>
            body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
    'image/jpeg': {
        extension: 'jpg',
        matches: (body) => body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
    },
    'image/webp': {
        extension: 'webp',
        matches: (body) =>
            body.subarray(0, 4).toString('ascii') === 'RIFF' &&
            body.subarray(8, 12).toString('ascii') === 'WEBP',
    },
};

interface IAvatarUpload {
    body: Buffer;
    mediaType: TClubAvatarMediaType;
    extension: string;
}

function isAvatarMediaType(value: string | undefined): value is TClubAvatarMediaType {
    return value !== undefined && value in signatures;
}

/** Accepts a PNG, JPEG, or WebP no larger than 512 KiB whose bytes match its declared type. */
export function parseAvatarUpload(body: unknown, contentType: string | undefined): IAvatarUpload {
    const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
    if (
        !isAvatarMediaType(mediaType) ||
        !Buffer.isBuffer(body) ||
        body.length === 0 ||
        body.length > CLUB_AVATAR_MAX_BYTES ||
        !signatures[mediaType].matches(body)
    ) {
        throw new BadRequestException();
    }
    return { body, mediaType, extension: signatures[mediaType].extension };
}

@Injectable()
export class ClubAvatarService {
    private readonly logger = new Logger(ClubAvatarService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    async get(userId: string, clubId: string): Promise<IStoredObject> {
        const { club } = await findMembership(this.prisma, userId, clubId);
        const avatar = club.avatarObjectKey ? await this.storage.get(club.avatarObjectKey) : null;
        if (!avatar) {
            throw new NotFoundException();
        }
        return avatar;
    }

    async replace(
        userId: string,
        clubId: string,
        body: unknown,
        contentType?: string,
    ): Promise<void> {
        const membership = await findMembership(this.prisma, userId, clubId);
        assertAdmin(membership);
        assertActive(membership);
        const upload = parseAvatarUpload(body, contentType);
        const key = `club-avatars/${clubId}/${randomUUID()}.${upload.extension}`;
        await this.storage.put(key, upload.body, upload.mediaType);
        try {
            await this.setAvatarKey(userId, clubId, key);
        } catch (error) {
            await this.removeObject(key);
            throw error;
        }
    }

    async remove(userId: string, clubId: string): Promise<void> {
        await this.setAvatarKey(userId, clubId, null);
    }

    private async setAvatarKey(userId: string, clubId: string, key: string | null): Promise<void> {
        const previousKey = await this.prisma.$transaction(async (transaction) => {
            const membership = await findMembership(transaction, userId, clubId);
            assertAdmin(membership);
            assertActive(membership);
            if (membership.club.avatarObjectKey === key) {
                return null;
            }
            await transaction.club.update({
                where: { id: clubId },
                data: { avatarObjectKey: key },
            });
            await recordAudit(transaction, {
                clubId,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'CLUB_AVATAR_UPDATED',
            });
            return membership.club.avatarObjectKey;
        });
        if (previousKey) {
            await this.removeObject(previousKey);
        }
    }

    /** A leftover object only costs storage, so cleanup failures are logged, not surfaced. */
    private async removeObject(key: string): Promise<void> {
        await this.storage.delete(key).catch((error: unknown) => {
            this.logger.error(`Club avatar cleanup failed: ${String(error)}`);
        });
    }
}
