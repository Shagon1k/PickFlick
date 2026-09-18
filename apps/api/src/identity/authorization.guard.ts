import type { ServerResponse } from "node:http";

import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { ApplicationLogger } from "@pickflick/observability";

import { APPLICATION_LOGGER } from "../runtime.tokens.js";
import { AUTHORIZATION_PUBLIC, AUTHORIZATION_ROLES } from "./authorization.decorators.js";
import {
  AUTHENTICATED_PRINCIPAL,
  IDENTITY_AUTHORIZATION,
  SSE_AUTHORIZATION_RECHECK_MILLISECONDS,
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
    @Inject(SSE_AUTHORIZATION_RECHECK_MILLISECONDS) private readonly sseRecheckMilliseconds: number,
  ) {}

  private monitorSseAuthorization(
    request: AuthenticatedRequest,
    response: ServerResponse,
    requiredRoles: readonly AppRole[],
  ): void {
    const initialPrincipal = request[AUTHENTICATED_PRINCIPAL];
    if (!initialPrincipal) {
      return;
    }

    let stopped = false;
    let timeout: NodeJS.Timeout | undefined;
    const stop = () => {
      stopped = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };
    const recheck = async () => {
      const resolution = await this.identity.resolveSession(request.headers);
      if (stopped || response.destroyed || response.writableEnded) {
        return;
      }
      const principal = resolution.authorized ? resolution.principal : undefined;
      const remainsAuthorized = Boolean(
        principal &&
        principal.sessionId === initialPrincipal.sessionId &&
        principal.userId === initialPrincipal.userId &&
        (requiredRoles.length === 0 || requiredRoles.includes(principal.appRole)),
      );
      if (!remainsAuthorized) {
        this.logger.warn(
          {
            event: "auth.sse.disconnected",
            reason: resolution.authorized ? "app_role_denied" : resolution.reason,
          },
          "SSE stream disconnected after authorization changed.",
        );
        response.destroy();
        return;
      }
      timeout = setTimeout(recheck, this.sseRecheckMilliseconds);
      timeout.unref();
    };

    response.once("close", stop);
    timeout = setTimeout(recheck, this.sseRecheckMilliseconds);
    timeout.unref();
  }

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
    if (this.reflector.getAllAndOverride<boolean>(SSE_METADATA, targets)) {
      const response = context.switchToHttp().getResponse<ServerResponse>();
      this.monitorSseAuthorization(request, response, requiredRoles);
    }
    return true;
  }
}
