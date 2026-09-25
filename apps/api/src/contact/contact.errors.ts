import { CONTACT_RATE_LIMIT_WINDOW_SECONDS } from './contact.constants.js';

export class ContactValidationError extends Error {
    constructor() {
        super('Contact submission validation failed.');
        this.name = 'ContactValidationError';
    }
}

export class ContactConflictError extends Error {
    constructor() {
        super('The submission key is already associated with different content.');
        this.name = 'ContactConflictError';
    }
}

export class ContactRateLimitError extends Error {
    readonly retryAfterSeconds = CONTACT_RATE_LIMIT_WINDOW_SECONDS;

    constructor() {
        super('The Contact submission rate limit was reached.');
        this.name = 'ContactRateLimitError';
    }
}
