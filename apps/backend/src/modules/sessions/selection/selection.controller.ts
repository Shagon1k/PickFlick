import { Body, Controller, Param, Post } from '@nestjs/common';
import {
    closeSelectionSchema,
    submitSelectionSchema,
    type TCloseSelection,
    type TSubmitSelection,
} from '@pickflick/contracts';

import { UUID_PARAM, ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SelectionService } from './selection.service.js';

@Controller('sessions/:sessionId/selection')
export class SelectionController {
    constructor(private readonly selection: SelectionService) {}

    @Post()
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(submitSelectionSchema)) input: TSubmitSelection,
    ) {
        return this.selection.submit(user.id, id, input);
    }

    @Post('close')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', UUID_PARAM) id: string,
        @Body(new ZodValidationPipe(closeSelectionSchema)) input: TCloseSelection,
    ) {
        return this.selection.close(user.id, id, input);
    }
}
