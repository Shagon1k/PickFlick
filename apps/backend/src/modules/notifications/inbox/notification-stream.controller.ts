import type { IncomingHttpHeaders } from 'node:http';

import { Controller, Query, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { concatMap, interval, map, merge, of } from 'rxjs';

import { EMPTY_REQUEST } from '../../../common/pipes/zod-validation.pipe.js';
import { AuthService } from '../../auth/auth.service.js';
import type { IAuthUser } from '../../auth/auth.types.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { NotificationSignals } from '../notification-signals.js';

const HEARTBEAT_MS = 30_000;

@Controller('notifications')
export class NotificationStreamController {
    constructor(
        private readonly auth: AuthService,
        private readonly signals: NotificationSignals,
    ) {}

    @Sse('stream')
    stream(
        @Query(EMPTY_REQUEST)
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Req() request: { headers: IncomingHttpHeaders },
    ) {
        return merge(
            of({ data: { refresh: true } }),
            this.signals.forRecipient(user.id),
            interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'heartbeat', data: '' }))),
        ).pipe(
            concatMap(async (event) => {
                const current = await this.auth.resolveUser(request.headers);
                if (current?.id !== user.id) throw new UnauthorizedException();
                return event;
            }),
        );
    }
}
