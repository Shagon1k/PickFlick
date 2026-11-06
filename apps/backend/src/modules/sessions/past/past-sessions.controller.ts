import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { createPastSessionSchema, type TCreatePastSession } from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SessionsService } from '../sessions.service.js';
import { PastSessionsService } from './past-sessions.service.js';

@Controller('clubs/:clubId/sessions/past')
export class PastSessionsController {
    constructor(
        private readonly past: PastSessionsService,
        private readonly sessions: SessionsService,
    ) {}

    @Get('members')
    listMembers(@CurrentUser() user: IAuthUser, @Param('clubId', UUID_PARAM) clubId: string) {
        return this.past.listMembers(user.id, clubId);
    }

    @Post()
    async create(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Body(new ZodValidationPipe(createPastSessionSchema)) input: TCreatePastSession,
    ) {
        const id = await this.past.create(user.id, clubId, input);
        return this.sessions.get(user.id, id);
    }
}
