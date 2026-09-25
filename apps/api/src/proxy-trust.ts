import type { INestApplication } from '@nestjs/common';

export const TRUSTED_PROXY_HOPS = 2;

export function configureProxyTrust(app: INestApplication): void {
    // Next is the socket peer; Traefik's preserved header contributes the Cloudflare hop.
    app.getHttpAdapter().getInstance().set('trust proxy', TRUSTED_PROXY_HOPS);
}
