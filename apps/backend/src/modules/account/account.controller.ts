import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
    appearanceSchema,
    type TAppearance,
    type TUpdateProfile,
    updateProfileSchema,
} from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AccountService } from './account.service.js';

@Controller('account')
export class AccountController {
    constructor(private readonly accounts: AccountService) {}

    @Get()
    get(@Query(EMPTY_REQUEST) query: Record<string, never>, @CurrentUser() user: IAuthUser) {
        return this.accounts.get(user.id);
    }

    @Put('profile')
    updateProfile(
        @CurrentUser() user: IAuthUser,
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(new ZodValidationPipe(updateProfileSchema)) input: TUpdateProfile,
    ) {
        return this.accounts.updateProfile(user.id, input);
    }

    @Put('appearance')
    updateAppearance(
        @CurrentUser() user: IAuthUser,
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(new ZodValidationPipe(appearanceSchema)) input: TAppearance,
    ) {
        return this.accounts.updateAppearance(user.id, input);
    }
}
