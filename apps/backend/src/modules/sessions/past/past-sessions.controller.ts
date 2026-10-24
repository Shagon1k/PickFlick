import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createPastSessionSchema, type TCreatePastSession } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SessionsService } from '../sessions.service.js';
import { PastSessionsService } from './past-sessions.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('clubs/:clubId/sessions/past')
export class PastSessionsController {
    constructor(
        private readonly past: PastSessionsService,
        private readonly sessions: SessionsService,
    ) {}

    @Get('members')
    @Header('Cache-Control', 'private, no-store')
    listMembers(@CurrentUser() user: IAuthUser, @Param('clubId', uuid) clubId: string) {
        return this.past.listMembers(user.id, clubId);
    }

    @Post()
    @Header('Cache-Control', 'private, no-store')
    async create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', uuid) clubId: string,
        @Body(new ZodValidationPipe(createPastSessionSchema)) input: TCreatePastSession,
    ) {
        const id = await this.past.create(user.id, clubId, input);
        return this.sessions.get(user.id, id);
    }
}
