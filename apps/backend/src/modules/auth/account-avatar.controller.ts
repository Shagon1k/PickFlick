import { Controller, Get, Header, StreamableFile } from '@nestjs/common';

import { AccountAvatarService } from './account-avatar.service.js';
import type { IAuthUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

@Controller('account/avatar')
export class AccountAvatarController {
    constructor(private readonly avatars: AccountAvatarService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    async get(@CurrentUser() user: IAuthUser): Promise<StreamableFile> {
        const avatar = await this.avatars.get(user.id);
        return new StreamableFile(avatar.body, { type: avatar.contentType });
    }
}
