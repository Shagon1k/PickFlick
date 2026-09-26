import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy } from '@/lib/security-headers';

const PREVIEW_PREFIXES = ['/ui-preview', '/shell-preview'];

/**
 * Gives every page response a fresh CSP nonce. Next.js reads the policy from the request headers
 * and stamps the nonce on its own scripts; the root layout reads `x-nonce` for the theme script.
 *
 * Component and shell previews ship in every image because one image is promoted from UAT to
 * production. Production answers them with the ordinary 404 at request time.
 */
export function proxy(request: NextRequest): NextResponse {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', policy);

    const hidePreview =
        process.env.APP_ENV === 'production' &&
        PREVIEW_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
    const response = hidePreview
        ? NextResponse.rewrite(new URL('/__preview-unavailable', request.url), {
              request: { headers: requestHeaders },
          })
        : NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', policy);
    return response;
}

export const config = {
    matcher: [
        // Previews match unconditionally, so a prefetch cannot reach one in production.
        '/ui-preview/:path*',
        '/shell-preview/:path*',
        {
            // Pages only: the API, static files, and generated metadata carry no inline scripts.
            source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|opengraph-image).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
