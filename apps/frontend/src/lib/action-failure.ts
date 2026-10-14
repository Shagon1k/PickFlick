import 'server-only';

import { ApiError } from '#lib/api.server';

export interface IFailureCopy {
    /** Copy for a stable API reason; checked first. */
    reasons?: Partial<Record<string, string>>;
    /** Copy for groups of HTTP statuses, checked in order after the reasons. */
    statuses?: [statuses: number[], message: string][];
    /** Copy for anything else, including a network failure, which is also logged. */
    fallback: string;
    /** Names the failed request in that log line. */
    request: string;
}

/** The recovery copy a server action shows for a failed API request. */
export function getFailureMessage(error: unknown, copy: IFailureCopy): string {
    if (error instanceof ApiError) {
        const byReason = error.reason ? copy.reasons?.[error.reason] : undefined;
        if (byReason) return byReason;
        const byStatus = copy.statuses?.find(([statuses]) => statuses.includes(error.status));
        if (byStatus) return byStatus[1];
    }
    console.error(`${copy.request} failed.`);
    return copy.fallback;
}
