import { HTTP_STATUS } from '@pickflick/contracts';

/** A malformed ID or one the caller cannot see; pages answer as not found. */
export const NOT_FOUND_STATUSES = [HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.NOT_FOUND];

/** The caller can no longer act: signed out, forbidden, or the resource is gone. */
export const ACCESS_LOST_STATUSES = [
    HTTP_STATUS.UNAUTHORIZED,
    HTTP_STATUS.FORBIDDEN,
    HTTP_STATUS.NOT_FOUND,
];
