/**
 * Response headers every route sends, whatever the environment. Browsers ignore HSTS over plain
 * HTTP, so local and test servers can send it too.
 */
export const SECURITY_HEADERS = [
    { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
] as const;

/**
 * The Content Security Policy for one page response. Scripts run only with this request's nonce
 * (and what those scripts load); styles allow inline attributes because React and Mantine set
 * `style`, which a nonce cannot cover. Development adds `unsafe-eval` for React's error overlay.
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
}
