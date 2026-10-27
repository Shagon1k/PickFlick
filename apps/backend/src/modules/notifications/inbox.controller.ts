import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    HTTP_STATUS,
    notificationIdSchema,
    notificationListQuerySchema,
    notificationPreferencesQuerySchema,
    type TNotificationListQuery,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { InboxService } from './inbox.service.js';

// Open tabs and members of one watch party may share a client address.
const INBOX_RATE_LIMIT = { default: { ttl: 60_000, limit: 600 } };

@Controller('notifications')
export class InboxController {
    constructor(private readonly inbox: InboxService) {}

    @Get()
    @Throttle(INBOX_RATE_LIMIT)
    @Header('Cache-Control', 'private, no-store')
    list(
        @CurrentUser() user: IAuthUser,
        @Query(new ZodValidationPipe(notificationListQuerySchema)) query: TNotificationListQuery,
    ) {
        return this.inbox.list(user.id, query);
    }

    @Post('read')
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    @Header('Cache-Control', 'private, no-store')
    markAllRead(
        @Body(new ZodValidationPipe(notificationPreferencesQuerySchema))
        body: Record<string, never>,
        @Query(new ZodValidationPipe(notificationPreferencesQuerySchema))
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.inbox.markRead(user.id);
    }

    @Post(':id/read')
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    @Header('Cache-Control', 'private, no-store')
    markRead(
        @Body(new ZodValidationPipe(notificationPreferencesQuerySchema))
        body: Record<string, never>,
        @Param('id', new ZodValidationPipe(notificationIdSchema)) id: string,
        @Query(new ZodValidationPipe(notificationPreferencesQuerySchema))
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.inbox.markRead(user.id, id);
    }
}
