import { Module } from '@nestjs/common';

import { SessionRosterController } from './session-roster.controller.js';
import { SessionRosterService } from './session-roster.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
    controllers: [SessionsController, SessionRosterController],
    providers: [SessionsService, SessionRosterService],
})
export class SessionsModule {}
