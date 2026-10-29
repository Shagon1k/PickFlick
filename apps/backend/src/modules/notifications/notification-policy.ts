import type { TNotificationEvent } from '@pickflick/contracts';

export const NOTIFICATION_MESSAGES: Record<TNotificationEvent, string> = {
    SESSION_STARTED: 'A Session has started.',
    SELECTION_OPENED: 'Selection is open.',
    SELECTION_CLOSED: 'A Movie is ready to watch.',
    RATING_OPENED: 'Session Rating is open.',
    RATING_CLOSED: 'A Session has completed.',
    SESSION_CANCELLED: 'A Session was cancelled.',
    NOMINATION_STALLED: 'A Nomination deadline needs attention.',
    MEMBERSHIP_JOINED: 'Your Club Membership is active.',
    MEMBERSHIP_ROLE_CHANGED: 'Your Club role has changed.',
    MEMBERSHIP_REMOVED: 'Your Club Membership has ended.',
    MEMBERSHIP_LEFT: 'You have left a Club.',
    CLUB_ARCHIVED: 'A Club was archived.',
    CLUB_REACTIVATED: 'A Club was reactivated.',
    ACHIEVEMENT_EARNED: 'An achievement was earned.',
    CLUB_INACTIVITY_WARNING: 'A Club needs activity to stay active.',
    BILLING_SERVICE: 'A billing service update is available.',
};

const MEMBERSHIP_ENDED_EVENTS = new Set<TNotificationEvent>([
    'MEMBERSHIP_REMOVED',
    'MEMBERSHIP_LEFT',
]);

/** These notices reach a former member, so they stay readable without Club access or a link. */
export function isMembershipEndedEvent(event: TNotificationEvent) {
    return MEMBERSHIP_ENDED_EVENTS.has(event);
}

/** Service notices the recipient cannot switch off on either channel. */
export function isMandatoryNotification(event: TNotificationEvent) {
    return event === 'BILLING_SERVICE';
}

export function getNotificationPolicy(
    event: TNotificationEvent,
    preference?: { inApp: boolean; email: boolean } | null,
) {
    const isMandatory = isMandatoryNotification(event);
    return {
        event,
        inApp: isMandatory || (preference?.inApp ?? true),
        email: isMandatory || (preference?.email ?? false),
        mandatory: isMandatory,
    };
}
