import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { BetterAuthPlugin } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { PrismaService } from '../../database/prisma.service.js';
import { createAuth, type TAuth } from './auth.config.js';
import type { IAuthUser } from './auth.types.js';

/** Extra Better Auth plugins; integration tests add `testUtils()` to create sessions. */
export const AUTH_PLUGINS = Symbol('AUTH_PLUGINS');

// Better Auth serves many endpoints; PickFlick exposes only the ones its sign-in flow uses.
const EXPOSED_ROUTES = new Set([
    'GET /api/auth/get-session',
    'POST /api/auth/sign-in/social',
    'POST /api/auth/sign-out',
    'GET /api/auth/callback/google',
    'GET /api/auth/callback/apple',
    'POST /api/auth/callback/apple',
]);

@Injectable()
export class AuthService {
    readonly auth: TAuth;
    private readonly nodeHandler: (
        request: IncomingMessage,
        response: ServerResponse,
    ) => Promise<void>;

    constructor(
        @Inject(RUNTIME_ENVIRONMENT) environment: TRuntimeEnvironment,
        private readonly prisma: PrismaService,
        @Optional() @Inject(AUTH_PLUGINS) plugins: BetterAuthPlugin[] = [],
    ) {
        this.auth = createAuth(environment, prisma, plugins);
        this.nodeHandler = toNodeHandler(this.auth);
    }

    /** Express handler mounted at `/api/auth/*`. Unexposed Better Auth routes answer 404. */
    readonly handler = async (
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (!EXPOSED_ROUTES.has(`${request.method} ${path}`)) {
            response.statusCode = HttpStatus.NOT_FOUND;
            response.setHeader('content-type', 'application/json');
            response.end(
                JSON.stringify({ statusCode: HttpStatus.NOT_FOUND, message: 'Not Found' }),
            );
            return;
        }
        if (path === '/api/auth/get-session') {
            // Revokes a suspended User's sessions first, so get-session reports them signed out.
            await this.resolveUser(request.headers);
        }
        await this.nodeHandler(request, response);
    };

    /**
     * The User behind the request's session cookie, or null. A suspended User's sessions are
     * revoked here so the web stops treating the browser as signed in.
     */
    async resolveUser(headers: IncomingHttpHeaders): Promise<IAuthUser | null> {
        const result = await this.auth.api.getSession({
            headers: fromNodeHeaders(headers),
            query: { disableRefresh: true },
        });
        if (!result) {
            return null;
        }
        const user = await this.prisma.user.findUnique({
            where: { id: result.user.id },
            select: { appRole: true, status: true },
        });
        if (user?.status !== 'ACTIVE') {
            await this.prisma.authSession.deleteMany({ where: { userId: result.user.id } });
            return null;
        }
        return { id: result.user.id, appRole: user.appRole, sessionId: result.session.id };
    }
}
