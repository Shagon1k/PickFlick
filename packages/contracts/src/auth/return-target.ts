export const DEFAULT_AUTH_RETURN_TARGET = '/app';

const allowedReturnTargets = [
    /^\/movies\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    /^\/app$/u,
    /^\/invite\/(?:club|session)\/[\w-]{1,512}$/u,
    /^\/clubs\/new$/u,
    /^\/clubs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/settings)?$/u,
];

/** Sign-in may return only to these same-origin paths; anything else falls back to `/app`. */
export function isAllowedAuthReturnTarget(value: unknown): value is string {
    return typeof value === 'string' && allowedReturnTargets.some((pattern) => pattern.test(value));
}

export function resolveAuthReturnTarget(value: unknown): string {
    return isAllowedAuthReturnTarget(value) ? value : DEFAULT_AUTH_RETURN_TARGET;
}
