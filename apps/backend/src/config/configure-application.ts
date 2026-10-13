import type { NestExpressApplication } from '@nestjs/platform-express';
import { CLUB_AVATAR_MAX_BYTES, CLUB_AVATAR_MEDIA_TYPES } from '@pickflick/contracts';
import type { NextFunction, Request, Response } from 'express';

import { ApiExceptionFilter } from '../common/filters/api-exception.filter.js';
import { AuthService } from '../modules/auth/auth.service.js';

// Next is the socket peer; Traefik's forwarded header adds the Cloudflare hop.
const TRUSTED_PROXY_HOPS = 2;

/**
 * Next.js does not add its own headers to responses it proxies, so the API sends its own. API
 * responses are data, never a page, so their policy allows nothing to load or frame them.
 */
const API_SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
};

export function configureApplication(app: NestExpressApplication, shutdownHooks = true): void {
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
        limit: CLUB_AVATAR_MAX_BYTES + 88 * 1024,
        type: [...CLUB_AVATAR_MEDIA_TYPES],
    });
    app.getHttpAdapter().getInstance().all('/api/auth/*splat', app.get(AuthService).handler);
    app.useGlobalFilters(new ApiExceptionFilter());
    if (shutdownHooks) app.enableShutdownHooks();
}
