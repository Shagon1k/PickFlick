import { createServer } from "node:net";
import type { AddressInfo, Socket } from "node:net";

import { describe, expect, it } from "vitest";

import { SYNTHETIC_FIXTURES, assertSafeSeedOrResetTarget, checkDatabaseReadiness } from "../index.js";

describe("database safety", () => {
  it("allows only the positively identified local database", () => {
    expect(() =>
      assertSafeSeedOrResetTarget({
        appEnvironment: "local",
        databaseUrl: "postgresql://pickflick:password@127.0.0.1:5432/pickflick_local",
      }),
    ).not.toThrow();
  });

  it("allows a test database with an explicit test name", () => {
    expect(() =>
      assertSafeSeedOrResetTarget({
        appEnvironment: "test",
        databaseUrl: "postgresql://pickflick:password@postgres:5432/pickflick_test",
      }),
    ).not.toThrow();
  });

  it.each(["uat", "production"] as const)("refuses %s seed/reset targets", (appEnvironment) => {
    expect(() =>
      assertSafeSeedOrResetTarget({
        appEnvironment,
        databaseUrl: `postgresql://pickflick:password@database:5432/pickflick_${appEnvironment}`,
      }),
    ).toThrow(`Database seed/reset is disabled for APP_ENV=${appEnvironment}`);
  });

  it("refuses a local environment that points away from the loopback host", () => {
    expect(() =>
      assertSafeSeedOrResetTarget({
        appEnvironment: "local",
        databaseUrl: "postgresql://pickflick:password@database.internal:5432/pickflick_local",
      }),
    ).toThrow("Local seed/reset requires a loopback database host");
  });

  it("refuses a database host override in the connection query", () => {
    expect(() =>
      assertSafeSeedOrResetTarget({
        appEnvironment: "local",
        databaseUrl:
          "postgresql://pickflick:password@127.0.0.1:5432/pickflick_local?host=production.internal",
      }),
    ).toThrow("Database seed/reset does not allow a host query parameter");
  });

  it("uses deterministic synthetic fixture identifiers", () => {
    expect(SYNTHETIC_FIXTURES.club.id).toBe("10000000-0000-4000-8000-000000000001");
    expect(SYNTHETIC_FIXTURES.users.every(({ email }) => email.endsWith("@example.invalid"))).toBe(true);
  });

  it("cancels a database readiness connection at the driver deadline", async () => {
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;

    try {
      await expect(
        checkDatabaseReadiness(
          `postgresql://pickflick:password@127.0.0.1:${address.port}/pickflick_test`,
          25,
        ),
      ).rejects.toThrow();
    } finally {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  });
});
