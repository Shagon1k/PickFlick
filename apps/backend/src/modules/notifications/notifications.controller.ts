import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
    type TUpdateNotificationPreference,
    updateNotificationPreferenceSchema,
} from '@pickflick/contracts';

import { EMPTY_REQUEST, ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications/preferences')
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) {}

    @Get()
    getPreferences(
        @Query(EMPTY_REQUEST)
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.notifications.getPreferences(user.id);
    }

    @Put()
    updatePreference(
        @Query(EMPTY_REQUEST)
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(updateNotificationPreferenceSchema))
        input: TUpdateNotificationPreference,
    ) {
        return this.notifications.updatePreference(user.id, input);
    }
}
