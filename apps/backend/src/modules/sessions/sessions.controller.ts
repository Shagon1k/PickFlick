import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
    cancelSessionSchema,
    createSessionSchema,
    type TCancelSession,
    type TCreateSession,
    type TUpdateSession,
    updateSessionSchema,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SessionsService } from './sessions.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller()
export class SessionsController {
    constructor(private readonly sessions: SessionsService) {}

    @Get('sessions/:sessionId')
    @Header('Cache-Control', 'private, no-store')
    get(@CurrentUser() user: IAuthUser, @Param('sessionId', uuid) id: string) {
        return this.sessions.get(user.id, id);
    }

    @Post('clubs/:clubId/sessions')
    @Header('Cache-Control', 'private, no-store')
    create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', uuid) clubId: string,
        @Body(new ZodValidationPipe(createSessionSchema)) input: TCreateSession,
    ) {
        return this.sessions.create(user.id, clubId, input);
    }

    /** Clients poll this version and reload the Session projections when it grows. */
    @Get('sessions/:sessionId/progress')
    @Header('Cache-Control', 'private, no-store')
    getProgress(@CurrentUser() user: IAuthUser, @Param('sessionId', uuid) id: string) {
        return this.sessions.getProgress(user.id, id);
    }

    @Patch('sessions/:sessionId')
    @Header('Cache-Control', 'private, no-store')
    update(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Body(new ZodValidationPipe(updateSessionSchema)) input: TUpdateSession,
    ) {
        return this.sessions.update(user.id, id, input);
    }

    @Post('sessions/:sessionId/cancel')
    @Header('Cache-Control', 'private, no-store')
    cancel(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', uuid) id: string,
        @Body(new ZodValidationPipe(cancelSessionSchema)) input: TCancelSession,
    ) {
        return this.sessions.cancel(user.id, id, input);
    }
}
