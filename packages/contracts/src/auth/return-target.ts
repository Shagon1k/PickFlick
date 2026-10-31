import { clubRatingsQuerySchema } from '../clubs/ratings.schema.js';
import { libraryQuerySchema } from '../movies/library.schema.js';

export const DEFAULT_AUTH_RETURN_TARGET = '/app';

const allowedReturnTargets = [
    /^\/movies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    /^\/app$/u,
    /^\/library\?tab=achievements$/u,
    /^\/invite\/(?:club|session)\/[\w-]{1,512}$/u,
    /^\/clubs\/new$/u,
    /^\/clubs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/settings|\/members|\/sessions|\/sessions\/new|\/sessions\/past\/new|\/achievements)?$/u,
];

/** Sign-in may return only to these same-origin paths; anything else falls back to `/app`. */
export function isAllowedAuthReturnTarget(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (allowedReturnTargets.some((pattern) => pattern.test(value))) return true;
    const isRatings =
        /^\/clubs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/ratings(?:\?[^#]*)?$/u.test(
            value,
        );
    if (!isRatings && !/^\/library(?:\?[^#]*)?$/u.test(value)) return false;

    const parameters = new URL(value, 'https://pickflick.invalid').searchParams;
    const query = Object.fromEntries(parameters);
    return (
        parameters.size === Object.keys(query).length &&
        (isRatings ? clubRatingsQuerySchema : libraryQuerySchema).safeParse(query).success
    );
}

export function resolveAuthReturnTarget(value: unknown): string {
    return isAllowedAuthReturnTarget(value) ? value : DEFAULT_AUTH_RETURN_TARGET;
}
