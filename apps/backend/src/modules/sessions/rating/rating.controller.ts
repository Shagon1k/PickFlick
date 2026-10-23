import { Body, Controller, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
    closeRatingSchema,
    submitRatingSchema,
    type TCloseRating,
    type TSubmitRating,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RatingService } from './rating.service.js';

@Controller('sessions/:sessionId/rating')
export class RatingController {
    constructor(private readonly rating: RatingService) {}

    @Post()
    @Header('Cache-Control', 'private, no-store')
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(submitRatingSchema)) input: TSubmitRating,
    ) {
        return this.rating.submit(user.id, id, input);
    }

    @Post('close')
    @Header('Cache-Control', 'private, no-store')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(closeRatingSchema)) input: TCloseRating,
    ) {
        return this.rating.close(user.id, id, input);
    }
}
