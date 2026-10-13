import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MoviesModule } from '../movies/movies.module.js';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { SessionProgressController } from './session-progress.controller.js';
import { SessionProgressService } from './session-progress.service.js';
import { SessionRosterController } from './session-roster.controller.js';
import { SessionRosterService } from './session-roster.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
    imports: [MoviesModule, AuthModule],
    controllers: [
        SessionsController,
        SessionRosterController,
        NominationsController,
        SessionProgressController,
    ],
    providers: [SessionsService, SessionRosterService, NominationsService, SessionProgressService],
})
export class SessionsModule {}
