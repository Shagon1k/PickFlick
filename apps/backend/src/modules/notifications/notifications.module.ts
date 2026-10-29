import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EmailWebhookController } from './email/email-webhook.controller.js';
import { EmailWebhookService } from './email/email-webhook.service.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';
import { NotificationSignals } from './notification-signals.js';
import { NotificationStreamController } from './notification-stream.controller.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { Transactions } from './transactions.js';

@Module({
    imports: [AuthModule],
    controllers: [
        NotificationsController,
        InboxController,
        NotificationStreamController,
        EmailWebhookController,
    ],
    providers: [
        NotificationsService,
        InboxService,
        NotificationSignals,
        Transactions,
        EmailWebhookService,
    ],
    exports: [Transactions],
})
export class NotificationsModule {}
