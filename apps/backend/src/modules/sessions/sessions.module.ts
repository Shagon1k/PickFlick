import { Module } from '@nestjs/common';

import { MoviesModule } from '../movies/movies.module.js';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { SessionRosterController } from './session-roster.controller.js';
import { SessionRosterService } from './session-roster.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
    imports: [MoviesModule],
    controllers: [SessionsController, SessionRosterController, NominationsController],
    providers: [SessionsService, SessionRosterService, NominationsService],
})
export class SessionsModule {}
