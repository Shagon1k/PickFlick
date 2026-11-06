import { Module } from '@nestjs/common';

import { MoviesModule } from '../movies/movies.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClubAvatarService } from './club-avatar.service.js';
import { ClubLifecycleService } from './club-lifecycle.service.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';
import { ClubInvitationsController } from './invitations/club-invitations.controller.js';
import { ClubInvitationsService } from './invitations/club-invitations.service.js';
import { MemberAvatarController } from './member-avatars/member-avatar.controller.js';
import { MemberAvatarService } from './member-avatars/member-avatar.service.js';
import { ParticipantAvatarController } from './participant-avatars/participant-avatar.controller.js';
import { ParticipantAvatarService } from './participant-avatars/participant-avatar.service.js';
import { ClubRatingsController } from './statistics/club-ratings.controller.js';
import { ClubRatingsService } from './statistics/club-ratings.service.js';

@Module({
    imports: [MoviesModule, NotificationsModule],
    controllers: [
        ClubsController,
        ClubInvitationsController,
        ClubRatingsController,
        MemberAvatarController,
        ParticipantAvatarController,
    ],
    providers: [
        ClubsService,
        ClubLifecycleService,
        ClubAvatarService,
        ClubInvitationsService,
        ClubRatingsService,
        MemberAvatarService,
        ParticipantAvatarService,
    ],
})
export class ClubsModule {}
