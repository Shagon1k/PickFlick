import { Module } from '@nestjs/common';

import { MoviesModule } from '../movies/movies.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NominationsController } from './nominations/nominations.controller.js';
import { NominationsService } from './nominations/nominations.service.js';
import { PastSessionsController } from './past/past-sessions.controller.js';
import { PastSessionsService } from './past/past-sessions.service.js';
import { RatingController } from './rating/rating.controller.js';
import { RatingService } from './rating/rating.service.js';
import { SessionRosterController } from './roster/session-roster.controller.js';
import { SessionRosterService } from './roster/session-roster.service.js';
import { SelectionController } from './selection/selection.controller.js';
import { SelectionService } from './selection/selection.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { WatchingController } from './watching/watching.controller.js';
import { WatchingService } from './watching/watching.service.js';

@Module({
    imports: [MoviesModule, NotificationsModule],
    controllers: [
        SessionsController,
        PastSessionsController,
        SessionRosterController,
        NominationsController,
        SelectionController,
        WatchingController,
        RatingController,
    ],
    providers: [
        SessionsService,
        PastSessionsService,
        SessionRosterService,
        NominationsService,
        SelectionService,
        WatchingService,
        RatingService,
    ],
})
export class SessionsModule {}
