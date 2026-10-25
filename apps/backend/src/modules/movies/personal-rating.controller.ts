import { Body, Controller, Get, Header, Param, Put } from '@nestjs/common';
import {
    movieIdSchema,
    savePersonalRatingSchema,
    type TSavePersonalRating,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PersonalRatingService } from './personal-rating.service.js';

@Controller('movies/:movieId/personal-rating')
export class PersonalRatingController {
    constructor(private readonly ratings: PersonalRatingService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    async get(
        @CurrentUser() user: IAuthUser,
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
    ) {
        return { rating: await this.ratings.get(user.id, movieId) };
    }

    @Put()
    @Header('Cache-Control', 'private, no-store')
    save(
        @CurrentUser() user: IAuthUser,
        @Param('movieId', new ZodValidationPipe(movieIdSchema)) movieId: string,
        @Body(new ZodValidationPipe(savePersonalRatingSchema)) input: TSavePersonalRating,
    ) {
        return this.ratings.save(user.id, movieId, input);
    }
}
