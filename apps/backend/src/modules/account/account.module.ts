import { Module } from '@nestjs/common';

import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AccountAvatarController } from './account-avatar.controller.js';
import { AccountAvatarService } from './account-avatar.service.js';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@Module({
    controllers: [AccountController, AccountAvatarController],
    providers: [AccountService, AccountAvatarService, AvatarCleanupService],
})
export class AccountModule {}
