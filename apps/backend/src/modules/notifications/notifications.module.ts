import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';
import { NotificationStreamController } from './notification-stream.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
    imports: [AuthModule],
    controllers: [NotificationsController, InboxController, NotificationStreamController],
    providers: [NotificationsService, InboxService],
})
export class NotificationsModule {}
