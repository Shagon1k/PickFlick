import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AccountAvatarController } from './account-avatar.controller.js';
import { AccountAvatarService } from './account-avatar.service.js';
import { AccountDeletionController } from './account-deletion.controller.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { AccountDeletionWorkerService } from './account-deletion-worker.service.js';
import { AvatarCleanupService } from './avatar-cleanup.service.js';

@Module({
    imports: [NotificationsModule],
    controllers: [AccountController, AccountAvatarController, AccountDeletionController],
    providers: [
        AccountService,
        AccountAvatarService,
        AvatarCleanupService,
        AccountDeletionService,
        AccountDeletionWorkerService,
    ],
})
export class AccountModule {}
