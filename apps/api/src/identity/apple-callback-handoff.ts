import { createHash } from "node:crypto";

import type { createDatabaseClient } from "@pickflick/database";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

const handoffLifetimeMilliseconds = 10 * 60 * 1_000;

function handoffIdentifier(state: string, code: string): string {
  return `apple-callback:${createHash("sha256").update(state).update("\0").update(code).digest("hex")}`;
}

export async function storeAppleCallbackProfile(
  database: ReturnType<typeof createDatabaseClient>,
  state: string,
  code: string,
  profile: string,
): Promise<void> {
  const pendingState = await database.authVerification.findFirst({
    where: { expiresAt: { gt: new Date() }, identifier: state },
    select: { id: true },
  });
  if (!pendingState) {
    return;
  }
  const identifier = handoffIdentifier(state, code);
  await database.$transaction([
    database.authVerification.deleteMany({ where: { identifier } }),
    database.authVerification.create({
      data: {
        expiresAt: new Date(Date.now() + handoffLifetimeMilliseconds),
        identifier,
        value: profile,
      },
    }),
  ]);
}

function callbackCoordinates(context: {
  params?: Record<string, unknown> | undefined;
  path?: string | undefined;
  query?: unknown | undefined;
}): { code: string; state: string } | undefined {
  if (context.path !== "/callback/:id" || context.params?.id !== "apple") {
    return undefined;
  }
  const query = context.query as Record<string, unknown> | undefined;
  const code = query?.code;
  const state = query?.state;
  return typeof code === "string" && typeof state === "string" ? { code, state } : undefined;
}

export function appleCallbackProfileHandoffPlugin(
  database: ReturnType<typeof createDatabaseClient>,
): BetterAuthPlugin {
  return {
    id: "pickflick-apple-callback-profile-handoff",
    hooks: {
      before: [{
        matcher: (context) => Boolean(callbackCoordinates(context)),
        handler: createAuthMiddleware(async (context) => {
          const coordinates = callbackCoordinates(context);
          if (!coordinates) {
            return;
          }
          const handoff = await database.authVerification.findFirst({
            where: {
              expiresAt: { gt: new Date() },
              identifier: handoffIdentifier(coordinates.state, coordinates.code),
            },
            orderBy: { createdAt: "desc" },
          });
          if (handoff && context.query) {
            (context.query as Record<string, unknown>).user = handoff.value;
          }
        }),
      }],
      after: [{
        matcher: (context) => Boolean(callbackCoordinates(context)),
        handler: createAuthMiddleware(async (context) => {
          const coordinates = callbackCoordinates(context);
          if (!coordinates) {
            return;
          }
          try {
            await database.authVerification.deleteMany({
              where: { identifier: handoffIdentifier(coordinates.state, coordinates.code) },
            });
          } catch (error) {
            context.context.logger.error("Failed to remove an Apple callback profile handoff.", error);
          }
        }),
      }],
    },
  };
}
