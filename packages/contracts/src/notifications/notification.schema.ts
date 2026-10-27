import { z } from 'zod';

export const NOTIFICATION_EVENTS = [
    'SESSION_STARTED',
    'SELECTION_OPENED',
    'SELECTION_CLOSED',
    'RATING_OPENED',
    'RATING_CLOSED',
    'SESSION_CANCELLED',
    'NOMINATION_STALLED',
    'MEMBERSHIP_JOINED',
    'MEMBERSHIP_ROLE_CHANGED',
    'MEMBERSHIP_REMOVED',
    'MEMBERSHIP_LEFT',
    'CLUB_ARCHIVED',
    'CLUB_REACTIVATED',
    'ACHIEVEMENT_EARNED',
    'CLUB_INACTIVITY_WARNING',
    'BILLING_SERVICE',
] as const;
export const notificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type TNotificationEvent = z.infer<typeof notificationEventSchema>;

export const notificationPreferenceSchema = z.strictObject({
    event: notificationEventSchema,
    inApp: z.boolean(),
    email: z.boolean(),
    mandatory: z.boolean(),
});
export const notificationPreferencesSchema = z.strictObject({
    items: z.array(notificationPreferenceSchema),
});
export type TNotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const updateNotificationPreferenceSchema = notificationPreferenceSchema.omit({
    mandatory: true,
});
export type TUpdateNotificationPreference = z.infer<typeof updateNotificationPreferenceSchema>;
export const notificationPreferencesQuerySchema = z.strictObject({});
