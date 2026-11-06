import { Injectable, NotFoundException } from '@nestjs/common';

import { downloadGoogleAvatar } from '../../../common/google-avatar.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { findMembership } from '../access/club-access.js';

@Injectable()
export class MemberAvatarService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, clubId: string, membershipId: string) {
        const image = await this.prisma.$transaction(
            async (tx) => {
                await findMembership(tx, userId, clubId);
                const member = await tx.membership.findFirst({
                    where: { id: membershipId, clubId, status: 'ACTIVE' },
                    select: { user: { select: { image: true } } },
                });
                if (!member) throw new NotFoundException();
                return member.user.image;
            },
            { isolationLevel: 'RepeatableRead' },
        );
        return downloadGoogleAvatar(image);
    }
}
