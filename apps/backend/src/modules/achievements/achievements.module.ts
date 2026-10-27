import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { AchievementsController } from './achievements.controller.js';
import { AchievementsService } from './achievements.service.js';

@Module({
    imports: [NotificationsModule],
    controllers: [AchievementsController],
    providers: [AchievementsService],
})
export class AchievementsModule {}
