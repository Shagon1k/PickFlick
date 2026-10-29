import { Body, Controller, Param, Post } from '@nestjs/common';
import { openRatingSchema, type TOpenRating } from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { WatchingService } from './watching.service.js';

@Controller('sessions/:sessionId/rating')
export class WatchingController {
    constructor(private readonly watching: WatchingService) {}

    @Post('open')
    openRating(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(openRatingSchema)) input: TOpenRating,
    ) {
        return this.watching.openRating(user.id, id, input);
    }
}
