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

@Module({
    imports: [MoviesModule],
    controllers: [
        SessionsController,
        SessionRosterController,
        NominationsController,
        SelectionController,
    ],
    providers: [SessionsService, SessionRosterService, NominationsService, SelectionService],
})
export class SessionsModule {}
