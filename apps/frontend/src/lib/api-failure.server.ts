import { ApiError } from './api.server';

/** Matches known API failures; callers retain their own unexpected-error handling. */
export function apiFailureMessage(
    error: unknown,
    messages: {
        reasons?: Record<string, string>;
        statuses?: Record<number, string>;
    },
): string | undefined {
    if (!(error instanceof ApiError)) return undefined;
    return (
        (error.reason ? messages.reasons?.[error.reason] : undefined) ??
        messages.statuses?.[error.status]
    );
}
