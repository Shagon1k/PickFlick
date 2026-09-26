export const CANONICAL_ORIGIN = 'https://pick-flick.app';

export const INDEXABLE_PUBLIC_ROUTES = [
    '/',
    '/pricing',
    '/contact',
    '/legal/privacy',
    '/legal/terms',
] as const;

export const NON_PUBLIC_INDEXING_BOUNDARIES = [
    { headerSource: '/login', robotsPath: '/login' },
    { headerSource: '/invite/:path*', robotsPath: '/invite/' },
    { headerSource: '/app/:path*', robotsPath: '/app' },
    { headerSource: '/clubs/:path*', robotsPath: '/clubs/' },
    { headerSource: '/sessions/:path*', robotsPath: '/sessions/' },
    { headerSource: '/library/:path*', robotsPath: '/library' },
    { headerSource: '/movies/:path*', robotsPath: '/movies/' },
    { headerSource: '/settings/:path*', robotsPath: '/settings' },
    { headerSource: '/admin/:path*', robotsPath: '/admin' },
    { headerSource: '/shell-preview/:path*', robotsPath: '/shell-preview' },
    { headerSource: '/ui-preview/:path*', robotsPath: '/ui-preview' },
] as const;

export const NOINDEX_HEADER = {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive',
} as const;
