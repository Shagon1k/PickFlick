import { Injectable, NotFoundException } from '@nestjs/common';

import { downloadGoogleAvatar } from '../../../common/google-avatar.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { findMembership } from '../access/club-access.js';

@Injectable()
export class ParticipantAvatarService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string, clubId: string, sessionId: string, participantId: string) {
        const image = await this.prisma.$transaction(
            async (tx) => {
                await findMembership(tx, userId, clubId);
                const participant = await tx.sessionParticipant.findFirst({
                    where: { id: participantId, sessionId, clubId, status: 'ACCEPTED' },
                    select: { membership: { select: { user: { select: { image: true } } } } },
                });
                if (!participant) throw new NotFoundException();
                return participant.membership.user.image;
            },
            { isolationLevel: 'RepeatableRead' },
        );
        return downloadGoogleAvatar(image);
    }
}
