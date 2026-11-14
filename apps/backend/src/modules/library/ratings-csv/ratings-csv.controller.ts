import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import { EMPTY_REQUEST } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RatingsCsvService } from './ratings-csv.service.js';

@Controller('library/ratings-csv')
export class RatingsCsvController {
    constructor(private readonly csv: RatingsCsvService) {}

    @Get()
    export(@Query(EMPTY_REQUEST) query: Record<string, never>, @CurrentUser() user: IAuthUser) {
        return this.csv.export(user.id);
    }

    @Post('preview')
    @HttpCode(HttpStatus.OK)
    preview(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Body() input: unknown,
    ) {
        return this.csv.preview(user.id, input);
    }

    @Post('import')
    @HttpCode(HttpStatus.OK)
    import(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Body() input: unknown,
    ) {
        return this.csv.import(user.id, input);
    }
}
