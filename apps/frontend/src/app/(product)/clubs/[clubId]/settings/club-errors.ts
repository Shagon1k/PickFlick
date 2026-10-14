import type { TClubConflictReason } from '@pickflick/contracts';

const CONFLICT_MESSAGES: Record<TClubConflictReason, string> = {
    CONFIRMATION_MISMATCH:
        'The confirmation did not match. Type it exactly as shown, then confirm again.',
    ADMIN_CLUB_LIMIT_REACHED:
        'You already administer the most active Clubs your plan allows. Archive another Club or upgrade first.',
    ADMIN_MUST_TRANSFER:
        'A Club Admin must transfer administration or delete the Club before leaving.',
    SESSION_HISTORY: 'Clubs with Session history can be archived, but not deleted.',
    CLUB_ARCHIVED: 'This Club is archived. Reactivate it before making changes.',
    TIER_SETTING_UNAVAILABLE: 'Showing Selection results is a Pro Club setting.',
    MEMBERSHIP_INELIGIBLE:
        "That member's role can no longer be changed. Reload to see the current roster.",
};

function isConflictReason(reason: string | undefined): reason is TClubConflictReason {
    return reason !== undefined && Object.hasOwn(CONFLICT_MESSAGES, reason);
}

/** Recovery copy for a failed Club request, by HTTP status and conflict reason. */
export function getClubFailureMessage(status: number, reason?: string): string {
    if (status === 400) {
        return 'The Club rejected these values. Review the form and try again.';
    }
    if (status === 401) {
        return 'Your session expired. Sign in again, then retry.';
    }
    if (status === 403) {
        return 'Your current Club role does not allow that action.';
    }
    if (status === 404) {
        return 'This Club is no longer available to you. Return to your Clubs.';
    }
    if (status === 409 && isConflictReason(reason)) {
        return CONFLICT_MESSAGES[reason];
    }
    if (status === 409) {
        return 'The Club changed since this page loaded. Reload and try again.';
    }
    return "We couldn't reach the Club right now. Reload to check whether the change was applied, then retry.";
}
