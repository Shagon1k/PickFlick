import {
    Controller,
    Get,
    Header,
    HttpException,
    Logger,
    type OnModuleDestroy,
    Param,
    ParseUUIDPipe,
    Req,
    Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { exhaustMap, timer } from 'rxjs';

import { SessionProgressService } from './session-progress.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('sessions/:sessionId/progress')
export class SessionProgressController implements OnModuleDestroy {
    private readonly streams = new Set<Response>();
    private stopping = false;
    private readonly logger = new Logger(SessionProgressController.name);
    constructor(private readonly progress: SessionProgressService) {}

    onModuleDestroy() {
        this.stopping = true;
        for (const response of this.streams) response.end();
    }

    @Get()
    @Header('Cache-Control', 'private, no-store')
    snapshot(@Req() request: Request, @Param('sessionId', uuid) id: string) {
        return this.progress.snapshot(request.headers, id);
    }

    @Get('events')
    async events(
        @Req() request: Request,
        @Res() response: Response,
        @Param('sessionId', uuid) id: string,
    ) {
        const initial = await this.progress.snapshot(request.headers, id);
        if (response.destroyed || this.stopping) {
            response.end();
            return;
        }
        response.setHeader('Content-Type', 'text/event-stream');
        // Prevent intermediary compression from buffering small SSE signals.
        response.setHeader('Cache-Control', 'private, no-store, no-transform');
        response.setHeader('X-Accel-Buffering', 'no');
        response.flushHeaders();
        const send = (version: number) =>
            response.write(
                `id: ${version}\nevent: progress\ndata: ${JSON.stringify({ version })}\n\n`,
            );
        // A current snapshot on every connection heals missed events without replaying private data.
        send(initial.version);
        const subscription = timer(5000, 5000)
            .pipe(exhaustMap(() => this.progress.snapshot(request.headers, id)))
            .subscribe({
                next: ({ version }) => {
                    send(version);
                },
                error: (error: unknown) => {
                    const denied =
                        error instanceof HttpException &&
                        [401, 403, 404].includes(error.getStatus());
                    if (denied) response.write('event: access-lost\ndata: {}\n\n');
                    else this.logger.warn('Session progress stream failed.');
                    response.end();
                },
            });
        this.streams.add(response);
        response.on('close', () => {
            subscription.unsubscribe();
            this.streams.delete(response);
        });
    }
}
