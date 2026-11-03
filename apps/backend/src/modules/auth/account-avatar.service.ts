import { Injectable, NotFoundException } from '@nestjs/common';

import { downloadGoogleAvatar } from '../../common/google-avatar.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class AccountAvatarService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { image: true },
        });
        if (!user) throw new NotFoundException();
        return downloadGoogleAvatar(user.image);
    }
}
