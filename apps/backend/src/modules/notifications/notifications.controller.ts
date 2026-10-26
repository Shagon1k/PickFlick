import { Body, Controller, Get, Header, Put, Query } from '@nestjs/common';
import {
    notificationPreferencesQuerySchema,
    type TUpdateNotificationPreference,
    updateNotificationPreferenceSchema,
} from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { IAuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications/preferences')
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) {}

    @Get()
    @Header('Cache-Control', 'private, no-store')
    getPreferences(
        @Query(new ZodValidationPipe(notificationPreferencesQuerySchema))
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
    ) {
        return this.notifications.getPreferences(user.id);
    }

    @Put()
    @Header('Cache-Control', 'private, no-store')
    updatePreference(
        @Query(new ZodValidationPipe(notificationPreferencesQuerySchema))
        query: Record<string, never>,
        @CurrentUser() user: IAuthUser,
        @Body(new ZodValidationPipe(updateNotificationPreferenceSchema))
        input: TUpdateNotificationPreference,
    ) {
        return this.notifications.updatePreference(user.id, input);
    }
}
