import { Module } from '@nestjs/common';

import { ClubAvatarService } from './club-avatar.service.js';
import { ClubLifecycleService } from './club-lifecycle.service.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';
import { ClubInvitationsController } from './invitations/club-invitations.controller.js';
import { ClubInvitationsService } from './invitations/club-invitations.service.js';

@Module({
    controllers: [ClubsController, ClubInvitationsController],
    providers: [ClubsService, ClubLifecycleService, ClubAvatarService, ClubInvitationsService],
})
export class ClubsModule {}
