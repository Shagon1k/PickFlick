import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ApplicationLogger } from "@pickflick/observability";

import { APPLICATION_LOGGER } from "../runtime.tokens.js";
import { AUTHORIZATION_PUBLIC, AUTHORIZATION_ROLES } from "./authorization.decorators.js";
import {
  AUTHENTICATED_PRINCIPAL,
  IDENTITY_AUTHORIZATION,
  type AppRole,
  type AuthenticatedRequest,
  type IdentityAuthorizationBoundary,
} from "./authorization.types.js";

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_AUTHORIZATION) private readonly identity: IdentityAuthorizationBoundary,
    @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(AUTHORIZATION_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const resolution = await this.identity.resolveSession(request.headers);
    if (!resolution.authorized) {
      this.logger.warn(
        { event: "auth.access.denied", reason: resolution.reason },
        "Protected request denied.",
      );
      if (resolution.reason === "service_unavailable") {
        throw new ServiceUnavailableException();
      }
      throw new UnauthorizedException();
    }

    const requiredRoles = this.reflector.getAllAndOverride<readonly AppRole[]>(AUTHORIZATION_ROLES, targets) ?? [];
    if (requiredRoles.length > 0 && !requiredRoles.includes(resolution.principal.appRole)) {
      this.logger.warn(
        { event: "auth.access.denied", reason: "app_role_denied" },
        "App role denied for protected request.",
      );
      throw new ForbiddenException();
    }

    request[AUTHENTICATED_PRINCIPAL] = resolution.principal;
    return true;
  }
}
