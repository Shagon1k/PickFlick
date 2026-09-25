import type { ClubConflictReason } from '@pickflick/contracts';

export class ClubAuthorizationError extends Error {
    override readonly name = 'ClubAuthorizationError';
}

export class ClubConflictError extends Error {
    override readonly name = 'ClubConflictError';

    constructor(
        readonly reason: ClubConflictReason,
        message: string,
    ) {
        super(message);
    }
}

export class ClubValidationError extends Error {
    override readonly name = 'ClubValidationError';
}
