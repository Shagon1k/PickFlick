import type { TNotificationEvent } from '@pickflick/contracts';

const MEMBERSHIP_ENDED_EVENTS = new Set<TNotificationEvent>([
    'MEMBERSHIP_REMOVED',
    'MEMBERSHIP_LEFT',
]);

/** These notices reach a former member, so they stay readable without Club access or a link. */
export function isMembershipEndedEvent(event: TNotificationEvent) {
    return MEMBERSHIP_ENDED_EVENTS.has(event);
}

/**
 * Joining and leaving are always the member's own action, and nobody is notified about their own
 * action, so these events keep their copy for stored rows but offer no preference.
 */
const UNSENT_EVENTS = new Set<TNotificationEvent>(['MEMBERSHIP_JOINED', 'MEMBERSHIP_LEFT']);

export function hasPreference(event: TNotificationEvent) {
    return !UNSENT_EVENTS.has(event);
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
