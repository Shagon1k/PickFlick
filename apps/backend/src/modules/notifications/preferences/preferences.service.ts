import { ConflictException, Injectable } from '@nestjs/common';
import {
    NOTIFICATION_EVENTS,
    type TNotificationPreferences,
    type TUpdateNotificationPreference,
} from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { getNotificationPolicy, isMandatoryNotification } from '../notification-policy.js';

@Injectable()
export class NotificationPreferencesService {
    constructor(private readonly prisma: PrismaService) {}

    async getPreferences(userId: string): Promise<TNotificationPreferences> {
        const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
        return {
            items: NOTIFICATION_EVENTS.map((event) =>
                getNotificationPolicy(
                    event,
                    rows.find((row) => row.event === event),
                ),
            ),
        };
    }

    async updatePreference(userId: string, input: TUpdateNotificationPreference) {
        if (isMandatoryNotification(input.event) && (!input.inApp || !input.email)) {
            throw new ConflictException({ reason: 'MANDATORY_NOTIFICATION' });
        }
        await this.prisma.notificationPreference.upsert({
            where: { userId_event: { userId, event: input.event } },
            create: { userId, ...input },
            update: input,
        });
        return this.getPreferences(userId);
    }
}
