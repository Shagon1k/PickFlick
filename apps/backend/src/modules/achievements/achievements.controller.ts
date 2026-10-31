import { Controller, Get, Param, Query } from '@nestjs/common';

import { EMPTY_REQUEST, UUID_PARAM } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AchievementsService } from './achievements.service.js';

@Controller()
export class AchievementsController {
    constructor(private readonly achievements: AchievementsService) {}

    @Get('library/achievements')
    listPersonal(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.achievements.listPersonal(user.id);
    }

    @Get('clubs/:clubId/achievements')
    listClub(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Param('clubId', UUID_PARAM) clubId: string,
    ) {
        return this.achievements.listClub(user.id, clubId);
    }
}
