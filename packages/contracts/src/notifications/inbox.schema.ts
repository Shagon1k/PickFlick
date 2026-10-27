import { z } from 'zod';

import { notificationEventSchema } from './notification.schema.js';

export const notificationIdSchema = z.uuid();
export const notificationListQuerySchema = z.strictObject({
    cursor: notificationIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type TNotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const notificationItemSchema = z.strictObject({
    id: notificationIdSchema,
    event: notificationEventSchema,
    createdAt: z.iso.datetime(),
    readAt: z.iso.datetime().nullable(),
    message: z.string(),
    href: z.string().nullable(),
});
export type TNotificationItem = z.infer<typeof notificationItemSchema>;
export const notificationListSchema = z.strictObject({
    items: z.array(notificationItemSchema),
    nextCursor: notificationIdSchema.nullable(),
    unreadCount: z.number().int().nonnegative(),
});
export type TNotificationList = z.infer<typeof notificationListSchema>;
