export const API_ERROR_CODES = [
    'VALIDATION_FAILED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'METHOD_NOT_ALLOWED',
    'CONFLICT',
    'PAYLOAD_TOO_LARGE',
    'UNSUPPORTED_MEDIA_TYPE',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
    'REQUEST_FAILED',
    'INTERNAL_ERROR',
] as const;

export type TApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface IApiErrorEnvelope {
    error: {
        code: TApiErrorCode;
        message: string;
        requestId: string;
        /** Stable module-specific cause, such as a `TClubConflictReason`, when the code is ambiguous. */
        reason?: string;
    };
}
