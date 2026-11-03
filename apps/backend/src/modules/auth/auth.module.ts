import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccountAvatarController } from './account-avatar.controller.js';
import { AccountAvatarService } from './account-avatar.service.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
    controllers: [AccountAvatarController],
    providers: [AuthService, AccountAvatarService, { provide: APP_GUARD, useClass: AuthGuard }],
    exports: [AuthService],
})
export class AuthModule {}
