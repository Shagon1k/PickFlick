import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    cancelSessionSchema,
    createSessionSchema,
    type TCancelSession,
    type TCreateSession,
    type TUpdateSession,
    updateSessionSchema,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SessionsService } from './sessions.service.js';

// Every open Session page polls progress every 5 seconds, and a watch party shares one address.
const PROGRESS_RATE_LIMIT = { default: { ttl: 60_000, limit: 600 } };

@Controller()
export class SessionsController {
    constructor(private readonly sessions: SessionsService) {}

    @Get('sessions/:sessionId')
    get(@CurrentUser() user: IAuthUser, @Param('sessionId', UUID_PARAM) id: string) {
        return this.sessions.get(user.id, id);
    }

    @Post('clubs/:clubId/sessions')
    create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Body(new ZodValidationPipe(createSessionSchema)) input: TCreateSession,
    ) {
        return this.sessions.create(user.id, clubId, input);
    }

    /** Clients poll this version and reload the Session projections when it grows. */
    @Get('sessions/:sessionId/progress')
    @Throttle(PROGRESS_RATE_LIMIT)
    getProgress(@CurrentUser() user: IAuthUser, @Param('sessionId', UUID_PARAM) id: string) {
        return this.sessions.getProgress(user.id, id);
    }

    @Patch('sessions/:sessionId')
    update(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(updateSessionSchema)) input: TUpdateSession,
    ) {
        return this.sessions.update(user.id, id, input);
    }

    @Post('sessions/:sessionId/cancel')
    cancel(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(cancelSessionSchema)) input: TCancelSession,
    ) {
        return this.sessions.cancel(user.id, id, input);
    }
}
