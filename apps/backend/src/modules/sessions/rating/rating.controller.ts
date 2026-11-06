import { Body, Controller, Param, Post } from '@nestjs/common';
import {
    closeRatingSchema,
    openRatingSchema,
    submitRatingSchema,
    type TCloseRating,
    type TOpenRating,
    type TSubmitRating,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RatingService } from './rating.service.js';

@Controller('sessions/:sessionId/rating')
export class RatingController {
    constructor(private readonly rating: RatingService) {}

    @Post('open')
    open(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(openRatingSchema)) input: TOpenRating,
    ) {
        return this.rating.open(user.id, id, input);
    }

    @Post()
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(submitRatingSchema)) input: TSubmitRating,
    ) {
        return this.rating.submit(user.id, id, input);
    }

    @Post('close')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(closeRatingSchema)) input: TCloseRating,
    ) {
        return this.rating.close(user.id, id, input);
    }
}
