import {
    type CanActivate,
    type ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from './auth.service.js';
import type { IAuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC } from './decorators/public.decorator.js';

/** Global guard: every route needs an active session unless it is marked `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly authService: AuthService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<IAuthenticatedRequest>();
        const user = await this.authService.resolveUser(request.headers);
        if (!user) {
            throw new UnauthorizedException();
        }
        request.user = user;
        return true;
    }
}
