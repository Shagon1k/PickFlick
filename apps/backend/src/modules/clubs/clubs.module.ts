import { Module } from '@nestjs/common';

import { ClubAvatarService } from './club-avatar.service.js';
import { ClubLifecycleService } from './club-lifecycle.service.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';

@Module({
    controllers: [ClubsController],
    providers: [ClubsService, ClubLifecycleService, ClubAvatarService],
})
export class ClubsModule {}
