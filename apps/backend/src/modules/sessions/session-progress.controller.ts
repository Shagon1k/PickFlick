import { Controller, Get, Header, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import type { Request } from 'express';

import { SessionProgressService } from './session-progress.service.js';

@Controller('sessions/:sessionId/progress')
export class SessionProgressController {
    constructor(private readonly progress: SessionProgressService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    snapshot(
        @Req() request: Request,
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) id: string,
    ) {
        return this.progress.snapshot(request.headers, id);
    }
}
