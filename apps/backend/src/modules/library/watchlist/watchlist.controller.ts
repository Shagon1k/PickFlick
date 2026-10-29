import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { movieIdSchema, saveWatchlistSchema, type TSaveWatchlist } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { WatchlistService } from './watchlist.service.js';

@Controller()
export class WatchlistController {
    constructor(private readonly watchlist: WatchlistService) {}

    @Get('movies/:movieId/watchlist')
    async get(
        @CurrentUser() user: IAuthUser,
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
    ) {
        return { item: await this.watchlist.get(user.id, movieId) };
    }

    @Put('movies/:movieId/watchlist')
    save(
        @CurrentUser() user: IAuthUser,
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
        @Body(new ZodValidationPipe(saveWatchlistSchema)) input: TSaveWatchlist,
    ) {
        return this.watchlist.save(user.id, movieId, input);
    }

    @Delete('movies/:movieId/watchlist')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @CurrentUser() user: IAuthUser,
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
    ) {
        return this.watchlist.remove(user.id, movieId);
    }
}
