import type { NestExpressApplication } from '@nestjs/platform-express';
import { CLUB_AVATAR_MAX_BYTES, CLUB_AVATAR_MEDIA_TYPES } from '@pickflick/contracts';
import type { NextFunction, Request, Response } from 'express';

import { ApiExceptionFilter } from '../common/filters/api-exception.filter.js';
import { AuthService } from '../modules/auth/auth.service.js';

const AVATAR_PARSER_HEADROOM_BYTES = 88 * 1024;

// Next is the socket peer; Traefik's forwarded header adds the Cloudflare hop.
const TRUSTED_PROXY_HOPS = 2;

/**
 * Next.js does not add its own headers to responses it proxies, so the API sends its own. API
 * responses are data, never a page, so their policy allows nothing to load or frame them.
 * Responses are personal and never cached; a route that may be cached sets its own Cache-Control.
 */
const API_SECURITY_HEADERS = {
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
};

export function configureApplication(app: NestExpressApplication): void {
    app.set('trust proxy', TRUSTED_PROXY_HOPS);
    app.disable('x-powered-by');
    app.use((_request: Request, response: Response, next: NextFunction) => {
        response.set(API_SECURITY_HEADERS);
        next();
    });
    app.useBodyParser('json', { limit: '100kb' });
    app.useBodyParser('urlencoded', { extended: true, limit: '100kb' });
    // Headroom above the avatar limit lets the service, not the parser, reject oversize images.
    app.useBodyParser('raw', {
        limit: CLUB_AVATAR_MAX_BYTES + AVATAR_PARSER_HEADROOM_BYTES,
        type: [...CLUB_AVATAR_MEDIA_TYPES],
    });
    app.getHttpAdapter().getInstance().all('/api/auth/*splat', app.get(AuthService).handler);
    app.useGlobalFilters(new ApiExceptionFilter());
    app.enableShutdownHooks();
}
