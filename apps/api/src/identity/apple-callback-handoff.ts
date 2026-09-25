import { createHash } from "node:crypto";

import type { createDatabaseClient } from "@pickflick/database";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

import { lockKeys } from "../database/advisory-lock.js";

const handoffLifetimeMilliseconds = 10 * 60 * 1_000;
const handoffPrefix = "apple-callback:";

function handoffIdentifier(state: string): string {
  return `${handoffPrefix}${createHash("sha256").update(state).digest("hex")}`;
}

function callbackCodeHash(state: string, code: string): string {
  return createHash("sha256").update(state).update("\0").update(code).digest("hex");
}

function handoffProfile(value: string, state: string, code: string): string | undefined {
  try {
    const parsed = JSON.parse(value) as { codeHash?: unknown; profile?: unknown };
    return parsed.codeHash === callbackCodeHash(state, code) && typeof parsed.profile === "string"
      ? parsed.profile
      : undefined;
  } catch {
    return undefined;
  }
}

export async function storeAppleCallbackProfile(
  database: ReturnType<typeof createDatabaseClient>,
  state: string,
  code: string,
  profile: string,
): Promise<void> {
  const identifier = handoffIdentifier(state);
  await database.$transaction(async (transaction) => {
    await lockKeys(transaction, identifier);
    const now = new Date();
    await transaction.authVerification.deleteMany({
      where: { expiresAt: { lte: now }, identifier: { startsWith: handoffPrefix } },
    });
    const pendingState = await transaction.authVerification.findFirst({
      where: { expiresAt: { gt: now }, identifier: state },
      select: { id: true },
    });
    if (!pendingState || await transaction.authVerification.findFirst({
      where: { expiresAt: { gt: now }, identifier },
      select: { id: true },
    })) {
      return;
    }
    await transaction.authVerification.create({
      data: {
        expiresAt: new Date(Date.now() + handoffLifetimeMilliseconds),
        identifier,
        value: JSON.stringify({ codeHash: callbackCodeHash(state, code), profile }),
      },
    });
  });
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
          const identifier = handoffIdentifier(coordinates.state);
          const now = new Date();
          await database.authVerification.deleteMany({
            where: { expiresAt: { lte: now }, identifier },
          });
          const handoff = await database.authVerification.findFirst({
            where: {
              expiresAt: { gt: now },
              identifier,
            },
            orderBy: { createdAt: "desc" },
          });
          const profile = handoff && handoffProfile(handoff.value, coordinates.state, coordinates.code);
          if (profile && context.query) {
            (context.query as Record<string, unknown>).user = profile;
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
              where: { identifier: handoffIdentifier(coordinates.state) },
            });
          } catch (error) {
            context.context.logger.error("Failed to remove an Apple callback profile handoff.", error);
          }
        }),
      }],
    },
  };
}
