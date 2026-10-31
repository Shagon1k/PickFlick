import { Body, Controller, Param, Post } from '@nestjs/common';
import {
    closeNominationSchema,
    submitNominationSchema,
    type TCloseNomination,
    type TSubmitNomination,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { NominationsService } from './nominations.service.js';

@Controller('sessions/:sessionId/nominations')
export class NominationsController {
    constructor(private readonly nominations: NominationsService) {}

    @Post()
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(submitNominationSchema)) input: TSubmitNomination,
    ) {
        return this.nominations.submit(user.id, id, input);
    }

    @Post('close')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(closeNominationSchema)) input: TCloseNomination,
    ) {
        return this.nominations.close(user.id, id, input);
    }
}
