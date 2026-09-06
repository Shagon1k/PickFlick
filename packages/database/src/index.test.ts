import { describe, expect, it } from "vitest";

import { SYNTHETIC_FIXTURES, assertSafeSeedOrResetTarget } from "./index.js";

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

  it("uses deterministic synthetic fixture identifiers", () => {
    expect(SYNTHETIC_FIXTURES.club.id).toBe("10000000-0000-4000-8000-000000000001");
    expect(SYNTHETIC_FIXTURES.users.every(({ email }) => email.endsWith("@example.invalid"))).toBe(true);
  });
});
