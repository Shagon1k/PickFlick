import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { achievementQuerySchema } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AchievementsService } from './achievements.service.js';

@Controller()
export class AchievementsController {
    constructor(private readonly achievements: AchievementsService) {}

    @Get('library/achievements')
    @Header('Cache-Control', 'private, no-store')
    listPersonal(
        @Query(new ZodValidationPipe(achievementQuerySchema)) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.achievements.listPersonal(user.id);
    }

    @Get('clubs/:clubId/achievements')
    @Header('Cache-Control', 'private, no-store')
    listClub(
        @Query(new ZodValidationPipe(achievementQuerySchema)) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
    ) {
        return this.achievements.listClub(user.id, clubId);
    }
}
