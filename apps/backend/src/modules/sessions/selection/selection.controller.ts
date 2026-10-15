import { Body, Controller, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
    closeSelectionSchema,
    submitSelectionSchema,
    type TCloseSelection,
    type TSubmitSelection,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { SelectionService } from './selection.service.js';

@Controller('sessions/:sessionId/selection')
export class SelectionController {
    constructor(private readonly selection: SelectionService) {}

    @Post()
    @Header('Cache-Control', 'private, no-store')
    submit(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(submitSelectionSchema)) input: TSubmitSelection,
    ) {
        return this.selection.submit(user.id, id, input);
    }

    @Post('close')
    @Header('Cache-Control', 'private, no-store')
    close(
        @CurrentUser() user: IAuthUser,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body(new ZodValidationPipe(closeSelectionSchema)) input: TCloseSelection,
    ) {
        return this.selection.close(user.id, id, input);
    }
}
