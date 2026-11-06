import { Controller, Get, Query } from '@nestjs/common';
import { libraryQuerySchema, type TLibraryQuery } from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LibraryService } from './library.service.js';

@Controller('library')
export class LibraryController {
    constructor(private readonly library: LibraryService) {}

    @Get('statistics')
    getStatistics(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.library.getStatistics(user.id);
    }

    @Get()
    list(
        @CurrentUser() user: IAuthUser,
        @Query(new ZodValidationPipe(libraryQuerySchema)) query: TLibraryQuery,
    ) {
        return this.library.list(user.id, query);
    }
}
