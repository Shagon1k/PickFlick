import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { downloadGoogleAvatar } from '../../common/google-avatar.js';
import { PrismaService } from '../../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { parseAccountAvatar } from './account-avatar-upload.js';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@Injectable()
export class AccountAvatarService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly cleanup: AvatarCleanupService,
    ) {}

    async get(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { image: true, avatarObjectKey: true, isAvatarRemoved: true },
        });
        if (!user || user.isAvatarRemoved) throw new NotFoundException();
        if (!user.avatarObjectKey) return downloadGoogleAvatar(user.image);
        const object = await this.storage.get(user.avatarObjectKey);
        if (!object) throw new NotFoundException();
        return object;
    }

    async replace(userId: string, body: unknown, contentType?: string): Promise<void> {
        const avatar = await parseAccountAvatar(body, contentType);
        const key = `account-avatars/${randomUUID()}.webp`;
        // Record before storage: interruption at any later point leaves a discoverable orphan.
        await this.prisma.accountAvatarObject.create({ data: { key } });
        try {
            await this.storage.put(key, avatar, 'image/webp');
            await this.setKey(userId, key);
        } catch (error) {
            await this.cleanup.remove(key);
            throw error;
        }
    }

    async remove(userId: string): Promise<void> {
        await this.setKey(userId, null);
    }

    private async setKey(userId: string, key: string | null): Promise<void> {
        const previousKey = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { avatarObjectKey: true },
            });
            if (!user) throw new NotFoundException();
            if (key)
                await tx.$queryRaw`SELECT key FROM "AccountAvatarObject" WHERE key = ${key} FOR UPDATE`;
            await tx.user.update({
                where: { id: userId },
                data: { avatarObjectKey: key, isAvatarRemoved: key === null },
            });
            return user.avatarObjectKey;
        });
        if (previousKey) await this.cleanup.remove(previousKey);
    }
}
