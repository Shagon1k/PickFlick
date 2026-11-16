import { Body, Controller, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { deleteAccountSchema, type TDeleteAccount } from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AccountDeletionService } from './account-deletion.service.js';

@Controller('account/deletion')
export class AccountDeletionController {
    constructor(private readonly deletion: AccountDeletionService) {}

    @Post('reauth')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.NO_CONTENT)
    prepare(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(EMPTY_REQUEST) body: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.deletion.prepare(user);
    }

    @Post()
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.ACCEPTED)
    accept(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(new ZodValidationPipe(deleteAccountSchema)) body: TDeleteAccount,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.deletion.accept(user);
    }
}
