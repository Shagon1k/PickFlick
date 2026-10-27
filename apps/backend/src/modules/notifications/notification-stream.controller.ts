import type { IncomingHttpHeaders } from 'node:http';

import { Controller, Query, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { notificationPreferencesQuerySchema } from '@pickflick/contracts';
import { exhaustMap, interval, startWith } from 'rxjs';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from '../auth/auth.service.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

const RECONCILE_MS = 5_000;

@Controller('notifications')
export class NotificationStreamController {
    constructor(private readonly auth: AuthService) {}

    @Sse('stream')
    stream(
        @Query(new ZodValidationPipe(notificationPreferencesQuerySchema))
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Req() request: { headers: IncomingHttpHeaders },
    ) {
        return interval(RECONCILE_MS).pipe(
            startWith(0),
            exhaustMap(async () => {
                const current = await this.auth.resolveUser(request.headers);
                if (current?.id !== user.id) throw new UnauthorizedException();
                // Signals carry no entity data. Every client reads its current authorized REST state.
                return { data: { refresh: true } };
            }),
        );
    }
}
