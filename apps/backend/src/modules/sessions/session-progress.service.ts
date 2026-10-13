import type { IncomingHttpHeaders } from 'node:http';

import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { TSessionProgress } from '@pickflick/contracts';

import { PrismaService } from '../../database/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { findMembership } from '../clubs/club-access.js';

@Injectable()
export class SessionProgressService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthService,
    ) {}

    async snapshot(headers: IncomingHttpHeaders, id: string): Promise<TSessionProgress> {
        // Long-lived streams re-resolve the session and permissions before every signal.
        const user = await this.auth.resolveUser(headers);
        if (!user) throw new UnauthorizedException();
        return this.prisma.$transaction(
            async (tx) => {
                const session = await tx.session.findUnique({ where: { id } });
                if (!session) throw new NotFoundException();
                await findMembership(tx, user.id, session.clubId);
                return { version: session.progressVersion };
            },
            { isolationLevel: 'RepeatableRead' },
        );
    }
}
