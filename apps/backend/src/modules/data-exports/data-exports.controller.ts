import {
    Body,
    Controller,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    StreamableFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    dataExportDownloadQuerySchema,
    requestDataExportSchema,
    type TDataExportDownloadQuery,
    type TRequestDataExport,
} from '@pickflick/contracts';

import {
    EMPTY_REQUEST,
    UUID_PARAM,
    ZodValidationPipe,
} from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DataExportsService } from './data-exports.service.js';

const REQUEST_LIMIT = { limit: 3, ttl: 600_000 };

@Controller('account/data-exports')
export class DataExportsController {
    constructor(private readonly exports: DataExportsService) {}

    @Post()
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.ACCEPTED)
    @Throttle({ default: REQUEST_LIMIT })
    request(
        @CurrentUser() user: IAuthUser,
        @Query(EMPTY_REQUEST) _query: Record<string, never>,
        @Body(new ZodValidationPipe(requestDataExportSchema)) input: TRequestDataExport,
    ) {
        return this.exports.request(user.id, input.requestId);
    }

    @Get(':id')
    @Header('Cache-Control', 'private, no-store')
    get(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Param('id', UUID_PARAM) id: string,
    ) {
        return this.exports.get(user.id, id);
    }

    @Post(':id/download-link')
    @Header('Cache-Control', 'private, no-store')
    @HttpCode(HttpStatus.OK)
    createLink(
        @Query(EMPTY_REQUEST) query: Record<string, never>,
        @Body(EMPTY_REQUEST) body: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Param('id', UUID_PARAM) id: string,
    ) {
        return this.exports.createLink(user.id, id);
    }

    @Get(':id/download')
    @Header('Cache-Control', 'private, no-store')
    async download(
        @CurrentUser() user: IAuthUser,
        @Param('id', UUID_PARAM) id: string,
        @Query(new ZodValidationPipe(dataExportDownloadQuerySchema))
        query: TDataExportDownloadQuery,
    ) {
        return new StreamableFile(await this.exports.download(user.id, id, query), {
            type: 'application/gzip',
            disposition: 'attachment; filename="pickflick-data.json.gz"',
        });
    }
}
