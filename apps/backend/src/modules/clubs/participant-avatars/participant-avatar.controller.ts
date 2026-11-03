import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';

import { UUID_PARAM } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { ParticipantAvatarService } from './participant-avatar.service.js';

@Controller('clubs/:clubId/sessions/:sessionId/participants/:participantId/avatar')
export class ParticipantAvatarController {
    constructor(private readonly avatars: ParticipantAvatarService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    async get(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Param('sessionId', UUID_PARAM) sessionId: string,
        @Param('participantId', UUID_PARAM) participantId: string,
    ): Promise<StreamableFile> {
        const avatar = await this.avatars.get(user.id, clubId, sessionId, participantId);
        return new StreamableFile(avatar.body, { type: avatar.contentType });
    }
}
