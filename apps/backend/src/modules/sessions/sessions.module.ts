import { Module } from '@nestjs/common';

import { MoviesModule } from '../movies/movies.module.js';
import { NominationsController } from './nominations/nominations.controller.js';
import { NominationsService } from './nominations/nominations.service.js';
import { SessionRosterController } from './roster/session-roster.controller.js';
import { SessionRosterService } from './roster/session-roster.service.js';
import { SelectionController } from './selection/selection.controller.js';
import { SelectionService } from './selection/selection.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
import { WatchingController } from './watching/watching.controller.js';
import { WatchingService } from './watching/watching.service.js';

@Module({
    imports: [MoviesModule],
    controllers: [
        SessionsController,
        SessionRosterController,
        NominationsController,
        SelectionController,
        WatchingController,
    ],
    providers: [
        SessionsService,
        SessionRosterService,
        NominationsService,
        SelectionService,
        WatchingService,
    ],
})
export class SessionsModule {}
