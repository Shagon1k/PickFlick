import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Headers,
    HttpCode,
    HttpStatus,
    Put,
    Query,
    StreamableFile,
} from '@nestjs/common';
import { accountAvatarQuerySchema, type TAccountAvatarQuery } from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AccountAvatarService } from './account-avatar.service.js';

@Controller('account/avatar')
export class AccountAvatarController {
    constructor(private readonly avatars: AccountAvatarService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    async get(
        @Query(new ZodValidationPipe(accountAvatarQuerySchema)) query: TAccountAvatarQuery,
        @CurrentUser() user: IAuthUser,
    ): Promise<StreamableFile> {
        const avatar = await this.avatars.get(user.id);
        return new StreamableFile(avatar.body, { type: avatar.contentType });
    }

    @Put()
    @HttpCode(HttpStatus.NO_CONTENT)
    replace(
        @CurrentUser() user: IAuthUser,
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body() body: unknown,
        @Headers('content-type') contentType?: string,
    ) {
        return this.avatars.replace(user.id, body, contentType);
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Query(EMPTY_REQUEST) query: Record<string, never>, @CurrentUser() user: IAuthUser) {
        return this.avatars.remove(user.id);
    }
}
