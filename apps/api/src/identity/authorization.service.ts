import type { IncomingHttpHeaders } from "node:http";

import { ForbiddenException } from "@nestjs/common";
import { createDatabaseClient } from "@pickflick/database";
import type { ApplicationLogger } from "@pickflick/observability";

import type {
  AppRole,
  AuthenticatedPrincipal,
  IdentityAuthorizationBoundary,
  IdentitySessionResolution,
} from "./authorization.types.js";
import { lockIdentityUser } from "./identity-lock.js";

interface AuthSessionResult {
  readonly session: {
    readonly expiresAt: Date | string;
    readonly id: string;
  };
  readonly user: {
    readonly id: string;
  };
}

type SessionReader = (headers: IncomingHttpHeaders) => Promise<AuthSessionResult | null>;
type IdentityDatabase = ReturnType<typeof createDatabaseClient>;

function isExpired(expiresAt: Date | string): boolean {
  const expiry = new Date(expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry <= Date.now();
}

async function assertCurrentAppAdmin(
  database: Pick<IdentityDatabase, "user">,
  actor: AuthenticatedPrincipal,
): Promise<void> {
  const currentActor = await database.user.findUnique({
    select: { appRole: true, status: true },
    where: { id: actor.userId },
  });
  if (currentActor?.appRole !== "APP_ADMIN" || currentActor.status !== "ACTIVE") {
    throw new ForbiddenException();
  }
}

export class IdentityAuthorizationService implements IdentityAuthorizationBoundary {
  constructor(
    private readonly database: IdentityDatabase,
    private readonly logger: ApplicationLogger,
    private readonly readSession: SessionReader,
  ) {}

  async resolveSession(headers: IncomingHttpHeaders): Promise<IdentitySessionResolution> {
    try {
      const authenticated = await this.readSession(headers);
      if (!authenticated?.session || isExpired(authenticated.session.expiresAt)) {
        return { authorized: false, reason: "invalid_session" };
      }

      const user = await this.database.user.findUnique({
        select: { appRole: true, status: true },
        where: { id: authenticated.user.id },
      });
      if (!user || user.status !== "ACTIVE") {
        if (user) {
          await this.database.authSession.deleteMany({ where: { userId: authenticated.user.id } });
        }
        this.logger.warn(
          { event: "auth.access.denied", reason: "inactive_user" },
          "Inactive User session denied.",
        );
        return { authorized: false, reason: "inactive_user" };
      }

      return {
        authorized: true,
        principal: {
          appRole: user.appRole,
          sessionId: authenticated.session.id,
          userId: authenticated.user.id,
        },
      };
    } catch {
      this.logger.error(
        { event: "auth.session.resolve.failed", reason: "service_unavailable" },
        "Authentication session resolution failed.",
      );
      return { authorized: false, reason: "service_unavailable" };
    }
  }

  async authorizeBackgroundUser(userId: string, requiredRoles: readonly AppRole[] = []): Promise<boolean> {
    const user = await this.database.user.findUnique({
      select: { appRole: true, status: true },
      where: { id: userId },
    });
    const authorized = Boolean(
      user?.status === "ACTIVE" && (requiredRoles.length === 0 || requiredRoles.includes(user.appRole)),
    );
    if (!authorized) {
      this.logger.warn(
        { event: "auth.background.denied", reason: "authorization_failed" },
        "Background-sensitive action denied.",
      );
    }
    return authorized;
  }

  async revokeAllSessions(actor: AuthenticatedPrincipal, userId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await assertCurrentAppAdmin(transaction, actor);
      await lockIdentityUser(transaction, userId);
      await transaction.authSession.deleteMany({ where: { userId } });
    });
    this.logger.info(
      { event: "auth.sessions.revoked", reason: "administrative_action" },
      "User sessions revoked.",
    );
  }

  async setAppRole(actor: AuthenticatedPrincipal, userId: string, appRole: AppRole): Promise<void> {
    const changed = await this.database.$transaction(async (transaction) => {
      await assertCurrentAppAdmin(transaction, actor);
      await lockIdentityUser(transaction, userId);
      const target = await transaction.user.findUnique({
        select: { appRole: true },
        where: { id: userId },
      });
      if (target?.appRole === appRole) {
        return false;
      }
      await transaction.user.update({ data: { appRole }, where: { id: userId } });
      await transaction.authSession.deleteMany({ where: { userId } });
      return true;
    });
    if (!changed) {
      return;
    }
    this.logger.info(
      { event: "auth.sessions.revoked", reason: "app_role_changed" },
      "User sessions revoked after an App role change.",
    );
  }

  async suspendUser(actor: AuthenticatedPrincipal, userId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await assertCurrentAppAdmin(transaction, actor);
      await lockIdentityUser(transaction, userId);
      await transaction.user.update({ data: { status: "SUSPENDED" }, where: { id: userId } });
      await transaction.authSession.deleteMany({ where: { userId } });
    });
    this.logger.info(
      { event: "auth.sessions.revoked", reason: "user_suspended" },
      "User suspended and sessions revoked.",
    );
  }
}
