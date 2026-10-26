import { Module } from '@nestjs/common';

import { MoviesModule } from '../movies/movies.module.js';
import { ClubAvatarService } from './club-avatar.service.js';
import { ClubLifecycleService } from './club-lifecycle.service.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';
import { ClubInvitationsController } from './invitations/club-invitations.controller.js';
import { ClubInvitationsService } from './invitations/club-invitations.service.js';
import { ClubRatingsController } from './statistics/club-ratings.controller.js';
import { ClubRatingsService } from './statistics/club-ratings.service.js';

@Module({
    imports: [MoviesModule],
    controllers: [ClubsController, ClubInvitationsController, ClubRatingsController],
    providers: [
        ClubsService,
        ClubLifecycleService,
        ClubAvatarService,
        ClubInvitationsService,
        ClubRatingsService,
    ],
})
export class ClubsModule {}
