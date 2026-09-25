import type { NestExpressApplication } from '@nestjs/platform-express';
import { CLUB_AVATAR_MAX_BYTES, CLUB_AVATAR_MEDIA_TYPES } from '@pickflick/contracts';

import { ApiExceptionFilter } from '../common/filters/api-exception.filter.js';
import { AuthService } from '../modules/auth/auth.service.js';

// Next is the socket peer; Traefik's forwarded header adds the Cloudflare hop.
const TRUSTED_PROXY_HOPS = 2;

export function configureApplication(app: NestExpressApplication): void {
    app.set('trust proxy', TRUSTED_PROXY_HOPS);
    app.useBodyParser('json', { limit: '100kb' });
    app.useBodyParser('urlencoded', { extended: true, limit: '100kb' });
    // Headroom above the avatar limit lets the service, not the parser, reject oversize images.
    app.useBodyParser('raw', {
        limit: CLUB_AVATAR_MAX_BYTES + 88 * 1024,
        type: [...CLUB_AVATAR_MEDIA_TYPES],
    });
    app.getHttpAdapter().getInstance().all('/api/auth/*splat', app.get(AuthService).handler);
    app.useGlobalFilters(new ApiExceptionFilter());
    app.enableShutdownHooks();
}
