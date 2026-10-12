import { Body, Controller, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
    closeNominationSchema,
    submitNominationSchema,
    type TCloseNomination,
    type TSubmitNomination,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NominationsService } from './nominations.service.js';

@Controller('sessions/:sessionId/nominations')
export class NominationsController {
    constructor(private readonly nominations: NominationsService) {}

    @Post()
    @Header('Cache-Control', 'private, no-store')
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(submitNominationSchema)) input: TSubmitNomination,
    ) {
        return this.nominations.submit(user.id, id, input);
    }

    @Post('close')
    @Header('Cache-Control', 'private, no-store')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(closeNominationSchema)) input: TCloseNomination,
    ) {
        return this.nominations.close(user.id, id, input);
    }
}
