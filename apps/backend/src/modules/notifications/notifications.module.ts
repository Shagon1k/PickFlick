import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EmailWebhookController } from './email-delivery/email-webhook.controller.js';
import { EmailWebhookService } from './email-delivery/email-webhook.service.js';
import { InboxController } from './inbox/inbox.controller.js';
import { InboxService } from './inbox/inbox.service.js';
import { NotificationStreamController } from './inbox/notification-stream.controller.js';
import { NotificationSignals } from './notification-signals.js';
import { NotificationPreferencesController } from './preferences/preferences.controller.js';
import { NotificationPreferencesService } from './preferences/preferences.service.js';
import { Transactions } from './transactions.js';

@Module({
    imports: [AuthModule],
    controllers: [
        NotificationPreferencesController,
        InboxController,
        NotificationStreamController,
        EmailWebhookController,
    ],
    providers: [
        NotificationPreferencesService,
        InboxService,
        NotificationSignals,
        Transactions,
        EmailWebhookService,
    ],
    exports: [Transactions],
})
export class NotificationsModule {}
