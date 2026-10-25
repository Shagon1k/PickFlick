import { libraryQuerySchema } from '../movies/library.schema.js';

export const DEFAULT_AUTH_RETURN_TARGET = '/app';

const allowedReturnTargets = [
    /^\/movies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    /^\/app$/u,
    /^\/invite\/(?:club|session)\/[\w-]{1,512}$/u,
    /^\/clubs\/new$/u,
    /^\/clubs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/settings|\/sessions\/new)?$/u,
];

/** Sign-in may return only to these same-origin paths; anything else falls back to `/app`. */
export function isAllowedAuthReturnTarget(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (allowedReturnTargets.some((pattern) => pattern.test(value))) return true;
    if (!/^\/library(?:\?[^#]*)?$/u.test(value)) return false;

    const parameters = new URLSearchParams(value.slice('/library'.length));
    const query = Object.fromEntries(parameters);
    return (
        parameters.size === Object.keys(query).length && libraryQuerySchema.safeParse(query).success
    );
}

export function resolveAuthReturnTarget(value: unknown): string {
    return isAllowedAuthReturnTarget(value) ? value : DEFAULT_AUTH_RETURN_TARGET;
}
