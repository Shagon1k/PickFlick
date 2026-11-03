'use server';

import { getClubSessionHistory } from '#api/clubs.server';
import { getFailureMessage } from '#lib/action-failure';
import { ApiError } from '#lib/api.server';
import { ACCESS_LOST_STATUSES } from '#lib/http-status';

export async function loadSessionHistoryAction(clubId: string, cursor: string) {
    try {
        return { ok: true as const, page: await getClubSessionHistory(clubId, cursor) };
    } catch (error) {
        return {
            ok: false as const,
            denied: error instanceof ApiError && ACCESS_LOST_STATUSES.includes(error.status),
            message: getFailureMessage(error, {
                request: 'Load Session history',
                fallback: 'Could not load more Sessions. Try again.',
                statuses: [
                    [[401], 'Sign in again to view Session history.'],
                    [[403, 404], 'Session history is no longer available.'],
                ],
            }),
        };
    }
}
