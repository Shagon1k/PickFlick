import { Body, Controller, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { openRatingSchema, type TOpenRating } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { WatchingService } from './watching.service.js';

@Controller('sessions/:sessionId/rating')
export class WatchingController {
    constructor(private readonly watching: WatchingService) {}

    @Post('open')
    @Header('Cache-Control', 'private, no-store')
    openRating(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(openRatingSchema)) input: TOpenRating,
    ) {
        return this.watching.openRating(user.id, id, input);
    }
}
