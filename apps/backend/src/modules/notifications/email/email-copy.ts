import type { TNotificationEvent } from '@pickflick/contracts';

interface IEmailCopy {
    subject: string;
    title: string;
    body: string;
    category: string;
    action: string;
}

export const EMAIL_COPY: Record<TNotificationEvent, IEmailCopy> = {
    SESSION_STARTED: {
        subject: 'A Session has started',
        title: 'A new Session. A shared screen.',
        body: 'A Session has started in one of your Clubs. Open PickFlick to see its current phase and participation options.',
        category: 'Session update',
        action: 'Open Session',
    },
    SELECTION_OPENED: {
        subject: 'Selection is open',
        title: 'Your next film is up to you.',
        body: 'Selection has opened for a Session. Open PickFlick to view the nominations and submit your scores while Selection is open.',
        category: 'Session update',
        action: 'Open Session',
    },
    SELECTION_CLOSED: {
        subject: 'A Movie is ready to watch',
        title: 'The choice is made.',
        body: 'A Movie has been chosen for a Session. Open PickFlick to see the result and screening details.',
        category: 'Session update',
        action: 'View Session',
    },
    RATING_OPENED: {
        subject: 'Session Rating is open',
        title: 'The credits rolled. Your turn.',
        body: 'Session Rating has opened. Open PickFlick to share your score and thoughts while Rating is open.',
        category: 'Session update',
        action: 'Open Session Rating',
    },
    RATING_CLOSED: {
        subject: 'A Session has completed',
        title: 'Another screening in the archive.',
        body: 'A Session has completed. Its history and the results you can access are available in PickFlick.',
        category: 'Session update',
        action: 'View Session history',
    },
    SESSION_CANCELLED: {
        subject: 'A Session was cancelled',
        title: 'A change of plans.',
        body: 'A Session was cancelled. Open PickFlick to check the update and your Club’s current activity.',
        category: 'Session update',
        action: 'View Session',
    },
    NOMINATION_STALLED: {
        subject: 'A Nomination deadline needs attention',
        title: 'The next step needs you.',
        body: 'A Nomination deadline passed without a nomination. Open the Session to review the available actions.',
        category: 'Session notice',
        action: 'Review Session',
    },
    MEMBERSHIP_JOINED: {
        subject: 'Your Club Membership is active',
        title: 'Welcome to the screening room.',
        body: 'Your Membership in a Club is active. Open PickFlick to see the Club and its Sessions.',
        category: 'Membership update',
        action: 'Open Club',
    },
    MEMBERSHIP_ROLE_CHANGED: {
        subject: 'Your Club role has changed',
        title: 'A new role in your Club.',
        body: 'Your role in a Club has changed. Open PickFlick to check your current role and available actions.',
        category: 'Membership update',
        action: 'Open Club',
    },
    MEMBERSHIP_REMOVED: {
        subject: 'Your Club Membership has ended',
        title: 'Your Membership has ended.',
        body: 'Your Membership in a Club has ended. Club content is no longer available through this notification.',
        category: 'Membership update',
        action: '',
    },
    MEMBERSHIP_LEFT: {
        subject: 'You have left a Club',
        title: 'Your departure is recorded.',
        body: 'You have left a Club. Club content is no longer available through this notification.',
        category: 'Membership update',
        action: '',
    },
    CLUB_ARCHIVED: {
        subject: 'A Club was archived',
        title: 'On pause. Still part of your story.',
        body: 'A Club was archived. Open PickFlick to view the Club’s available history and current status.',
        category: 'Club update',
        action: 'View Club',
    },
    CLUB_REACTIVATED: {
        subject: 'A Club was reactivated',
        title: 'The lights are back on.',
        body: 'A Club was reactivated. Open PickFlick to see its current activity.',
        category: 'Club update',
        action: 'Open Club',
    },
    ACHIEVEMENT_EARNED: {
        subject: 'An achievement was earned',
        title: 'A moment worth keeping.',
        body: 'A new achievement was earned. Open PickFlick to view the achievement and its details.',
        category: 'Achievement update',
        action: 'View achievement',
    },
    CLUB_INACTIVITY_WARNING: {
        subject: 'A Club needs activity to stay active',
        title: 'Keep the projector running.',
        body: 'A Club needs activity to stay active. Open PickFlick to review its status and available next steps.',
        category: 'Club service notice',
        action: 'Review Club',
    },
    BILLING_SERVICE: {
        subject: 'A billing service update is available',
        title: 'An update about your subscription.',
        body: 'A billing service update is available for your account. Sign in to PickFlick to review the details securely.',
        category: 'Billing service notice',
        action: 'Review account',
    },
};
