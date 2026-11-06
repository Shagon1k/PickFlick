import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';

import { UUID_PARAM } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { MemberAvatarService } from './member-avatar.service.js';

@Controller('clubs/:clubId/members/:membershipId/avatar')
export class MemberAvatarController {
    constructor(private readonly avatars: MemberAvatarService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    async get(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
        @Param('membershipId', UUID_PARAM) membershipId: string,
    ): Promise<StreamableFile> {
        const avatar = await this.avatars.get(user.id, clubId, membershipId);
        return new StreamableFile(avatar.body, { type: avatar.contentType });
    }
}
