import { HTTP_STATUS, type TClubConflictReason } from '@pickflick/contracts';

import type { IFailureCopy } from '#lib/action-failure';

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

/** Recovery copy for a failed Club request; every Club conflict reason has its own message. */
export const CLUB_FAILURE: IFailureCopy = {
    reasons: CONFLICT_MESSAGES,
    statuses: [
        [
            [HTTP_STATUS.BAD_REQUEST],
            'The Club rejected these values. Review the form and try again.',
        ],
        [[HTTP_STATUS.UNAUTHORIZED], 'Your session expired. Sign in again, then retry.'],
        [[HTTP_STATUS.FORBIDDEN], 'Your current Club role does not allow that action.'],
        [[HTTP_STATUS.NOT_FOUND], 'This Club is no longer available to you. Return to your Clubs.'],
        [[HTTP_STATUS.CONFLICT], 'The Club changed since this page loaded. Reload and try again.'],
    ],
    fallback:
        "We couldn't reach the Club right now. Reload to check whether the change was applied, then retry.",
    request: 'Club request',
};
