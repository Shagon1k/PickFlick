import { Injectable, NotFoundException } from '@nestjs/common';
import {
    appearanceSchema,
    type IAccountProfile,
    type TAppearance,
    type TUpdateProfile,
} from '@pickflick/contracts';

import { PrismaService } from '../../database/prisma.service.js';
import { getAccountAvatarUrl } from './account-avatar-path.js';

@Injectable()
export class AccountService {
    constructor(private readonly prisma: PrismaService) {}

    async get(userId: string): Promise<IAccountProfile> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                displayName: true,
                email: true,
                locale: true,
                image: true,
                avatarObjectKey: true,
                isAvatarRemoved: true,
                appearance: true,
                providerAccounts: { select: { provider: true } },
            },
        });
        if (!user) throw new NotFoundException();
        return {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            locale: user.locale,
            providers: user.providerAccounts.map(({ provider }) => provider),
            avatarUrl: getAccountAvatarUrl(user),
            appearance: appearanceSchema.parse(user.appearance),
        };
    }

    async updateProfile(userId: string, input: TUpdateProfile): Promise<IAccountProfile> {
        await this.prisma.user.update({ where: { id: userId }, data: input });
        return this.get(userId);
    }

    async updateAppearance(userId: string, input: TAppearance): Promise<IAccountProfile> {
        await this.prisma.user.update({ where: { id: userId }, data: { appearance: input } });
        return this.get(userId);
    }
}
