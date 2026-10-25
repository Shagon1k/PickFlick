import { Controller, Get, Header, Query } from '@nestjs/common';
import { libraryQuerySchema, type TLibraryQuery } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LibraryService } from './library.service.js';

@Controller('library')
export class LibraryController {
    constructor(private readonly library: LibraryService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    list(
        @CurrentUser() user: IAuthUser,
        @Query(new ZodValidationPipe(libraryQuerySchema)) query: TLibraryQuery,
    ) {
        return this.library.list(user.id, query);
    }
}
