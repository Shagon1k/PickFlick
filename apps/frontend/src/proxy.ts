import { HTTP_STATUS } from '@pickflick/contracts';
import { type NextRequest, NextResponse } from 'next/server';

import { getClubHub } from '#api/clubs.server';
import { ApiError } from '#lib/api.server';
import { NOT_FOUND_STATUSES } from '#lib/http-status';
import { LAST_CLUB_COOKIE, LAST_CLUB_COOKIE_OPTIONS } from '#lib/last-club';
import { buildContentSecurityPolicy } from '#lib/security-headers';

// The page itself answers these; any other failure is unexpected here.
const PAGE_HANDLED_STATUSES = [...NOT_FOUND_STATUSES, HTTP_STATUS.UNAUTHORIZED];

const PREVIEW_PREFIXES = ['/ui-preview', '/shell-preview'];
const CLUB_PATH =
    /^\/clubs\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/iu;

/**
 * Gives every page response a fresh CSP nonce. Next.js reads the policy from the request headers
 * and stamps the nonce on its own scripts; the root layout reads `x-nonce` for the theme script.
 *
 * Component and shell previews ship in every image because one image is promoted from UAT to
 * production. Production answers them with the ordinary 404 at request time.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', policy);

    const shouldHidePreview =
        process.env.APP_ENV === 'production' &&
        PREVIEW_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
    const response = shouldHidePreview
        ? NextResponse.rewrite(new URL('/__preview-unavailable', request.url), {
              request: { headers: requestHeaders },
          })
        : NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', policy);
    if (request.nextUrl.pathname.startsWith('/invite/')) {
        response.headers.set('Referrer-Policy', 'no-referrer');
        response.headers.set('Cache-Control', 'private, no-store');
    }
    const clubId = CLUB_PATH.exec(request.nextUrl.pathname)?.[1];
    if (
        clubId &&
        request.method === 'GET' &&
        request.cookies.get(LAST_CLUB_COOKIE)?.value !== clubId
    ) {
        try {
            await getClubHub(clubId, request.headers);
        } catch (error) {
            if (!(error instanceof ApiError && PAGE_HANDLED_STATUSES.includes(error.status))) {
                console.error('Club preference authorization failed.');
            }
            // The page owns access and service-failure states; keep the previous preference.
            return response;
        }
        response.cookies.set(LAST_CLUB_COOKIE, clubId, LAST_CLUB_COOKIE_OPTIONS);
    }
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
