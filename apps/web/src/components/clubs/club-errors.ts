import type { ClubConflictReason } from '@pickflick/contracts';

const conflictMessages: Readonly<Record<ClubConflictReason, string>> = {
    CONFIRMATION_MISMATCH:
        'The confirmation did not match. Type it exactly as shown, then confirm again.',
    ADMIN_CLUB_LIMIT_REACHED:
        'You already administer the most active Clubs your plan allows. Archive another Club or upgrade first.',
    ADMIN_MUST_TRANSFER:
        'A Club Admin must transfer administration or delete the Club before leaving.',
    SESSION_HISTORY: 'Clubs with Session history can be archived, but not deleted.',
    CLUB_ARCHIVED: 'This Club is archived. Reactivate it before making changes.',
    TIER_SETTING_UNAVAILABLE: 'Showing Selection results is a Pro Club setting.',
    OPERATION_REUSED:
        'This form was already used for a different change. Reload the page and try again.',
    MEMBERSHIP_INELIGIBLE:
        "That member's role can no longer be changed. Reload to see the current roster.",
};

function isClubConflictReason(reason: string | undefined): reason is ClubConflictReason {
    return reason !== undefined && Object.hasOwn(conflictMessages, reason);
}

/** Recovery copy for a failed Club management request, by HTTP status and conflict reason. */
export function clubFailureMessage(status: number, reason: string | undefined): string {
    if (status === 400) {
        return 'The Club rejected these values. Review the form and try again.';
    }
    if (status === 401) {
        return 'Your session expired. Sign in again, then retry.';
    }
    if (status === 403) {
        return 'Your current Club role does not allow that action.';
    }
    if (status === 409) {
        return isClubConflictReason(reason)
            ? conflictMessages[reason]
            : 'The Club changed since this page loaded. Reload and try again.';
    }
    return 'This Club action may have been applied. Reload to check current state, or retry now; the same operation ID will be used.';
}
