import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { clubRatingsQuerySchema, type TClubRatingsQuery } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { ClubRatingsService } from './club-ratings.service.js';

@Controller('clubs/:clubId/ratings')
export class ClubRatingsController {
    constructor(private readonly ratings: ClubRatingsService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    list(
        @CurrentUser() user: IAuthUser,
        @Param('clubId', new ParseUUIDPipe({ version: '4' })) clubId: string,
        @Query(new ZodValidationPipe(clubRatingsQuerySchema)) query: TClubRatingsQuery,
    ) {
        return this.ratings.list(user.id, clubId, query);
    }
}
