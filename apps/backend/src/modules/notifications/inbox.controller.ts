import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    HTTP_STATUS,
    notificationIdSchema,
    notificationListQuerySchema,
    type TNotificationListQuery,
} from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
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
    list(
        @CurrentUser() user: IAuthUser,
        @Query(new ZodValidationPipe(notificationListQuerySchema)) query: TNotificationListQuery,
    ) {
        return this.inbox.list(user.id, query);
    }

    @Post('read')
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    markAllRead(
        @Body(EMPTY_REQUEST)
        body: Record<string, never>,
        @Query(EMPTY_REQUEST)
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.inbox.markRead(user.id);
    }

    @Post(':id/read')
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    markRead(
        @Body(EMPTY_REQUEST)
        body: Record<string, never>,
        @Param('id', new ZodValidationPipe(notificationIdSchema)) id: string,
        @Query(EMPTY_REQUEST)
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.inbox.markRead(user.id, id);
    }
}
