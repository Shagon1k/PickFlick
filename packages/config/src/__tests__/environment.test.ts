import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parseDatabaseEnvironment,
  parseRuntimeEnvironment,
  parseWorkerEnvironment,
  safeEnvironmentValidationFailures,
} from "../environment.js";

const validEnvironment = {
  APP_ENV: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
  SHUTDOWN_TIMEOUT_MS: "10000",
  DATABASE_URL: "postgresql://pickflick:local-password@127.0.0.1:5432/pickflick_local",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  STORAGE_ENDPOINT: "http://127.0.0.1:9000",
  STORAGE_REGION: "us-east-1",
  STORAGE_BUCKET: "pickflick-local",
  STORAGE_ACCESS_KEY: "local-access-key",
  STORAGE_SECRET_KEY: "local-secret-key",
  STORAGE_FORCE_PATH_STYLE: "true",
  RESEND_API_KEY: "local-disabled",
  RESEND_FROM: "PickFlick <pickflick@example.invalid>",
  CONTACT_DELIVERY_TO: "contact@example.invalid",
  CONTACT_HASH_SECRET: "local-contact-hash-secret-for-tests",
} as const;

describe("environment validation", () => {
  it("reports validation field names and fixed rules without supplied values", () => {
    let error: unknown;
    try {
      parseRuntimeEnvironment({ ...validEnvironment, STORAGE_BUCKET: "Invalid Bucket" });
    } catch (caught) {
      error = caught;
    }

    expect(safeEnvironmentValidationFailures(error)).toEqual([
      "STORAGE_BUCKET must be a valid lowercase S3 bucket name",
    ]);
    expect(JSON.stringify(safeEnvironmentValidationFailures(error))).not.toContain("Invalid Bucket");
    expect(safeEnvironmentValidationFailures(new Error("other"))).toBeUndefined();
  });

  it("parses the typed runtime inventory", () => {
    expect(parseRuntimeEnvironment(validEnvironment)).toMatchObject({
      appEnvironment: "local",
      apiPort: 3001,
      shutdownTimeoutMilliseconds: 10_000,
      storage: { forcePathStyle: true },
      resend: { from: "PickFlick <pickflick@example.invalid>" },
      contact: { deliveryTo: "contact@example.invalid" },
    });
  });

  it("accepts a standard display name with spaces for the Resend sender", () => {
    expect(
      parseRuntimeEnvironment({ ...validEnvironment, RESEND_FROM: "PickFlick UAT <uat@pick-flick.app>" }),
    ).toMatchObject({ resend: { from: "PickFlick UAT <uat@pick-flick.app>" } });
  });

  it.each([
    '"PickFlick UAT <uat@pick-flick.app>"',
    "PickFlick UAT <uat@pick-flick.app> extra",
    "PickFlick UAT <uat@pick-flick.app>\nother@example.com",
  ])("rejects an unsafe or malformed Resend sender: %s", (from) => {
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, RESEND_FROM: from })).toThrow(
      /RESEND_FROM must be an email address or a name plus email address/,
    );
  });

  it("accepts the focused database inventory", () => {
    expect(parseDatabaseEnvironment(validEnvironment)).toEqual({
      appEnvironment: "local",
      databaseUrl: validEnvironment.DATABASE_URL,
    });
  });

  it("requires the storage and Resend provider contract", () => {
    expect(() =>
      parseWorkerEnvironment({
        ...validEnvironment,
        RESEND_API_KEY: undefined,
        STORAGE_ACCESS_KEY: undefined,
        CONTACT_HASH_SECRET: undefined,
      }),
    ).toThrow(/STORAGE_ACCESS_KEY is required; RESEND_API_KEY is required; CONTACT_HASH_SECRET is required/);
  });

  it("rejects unsafe Contact delivery configuration without echoing the secret", () => {
    expect(() =>
      parseWorkerEnvironment({
        ...validEnvironment,
        CONTACT_DELIVERY_TO: "not-an-email",
        CONTACT_HASH_SECRET: "too-short",
      }),
    ).toThrow(/CONTACT_DELIVERY_TO must be an email address; CONTACT_HASH_SECRET must contain at least 32 characters/);
  });

  it("requires the approved Contact destination in production", () => {
    expect(() =>
      parseWorkerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        RESEND_API_KEY: "production-key",
        CONTACT_DELIVERY_TO: "other@example.com",
      }),
    ).toThrow(/CONTACT_DELIVERY_TO must be hello@pick-flick.app in production/);
  });

  it.each(["uat", "production"])("rejects disabled Resend delivery in %s", (appEnvironment) => {
    expect(() =>
      parseWorkerEnvironment({
        ...validEnvironment,
        APP_ENV: appEnvironment,
        CONTACT_DELIVERY_TO: appEnvironment === "production" ? "hello@pick-flick.app" : "contact@example.invalid",
      }),
    ).toThrow(/RESEND_API_KEY must not be local-disabled outside local or test/);
  });

  it.each(["local", "test"])("allows disabled Resend delivery in %s", (appEnvironment) => {
    expect(parseWorkerEnvironment({ ...validEnvironment, APP_ENV: appEnvironment })).toMatchObject({
      appEnvironment,
      resend: { apiKey: "local-disabled" },
    });
  });

  it("accepts the worker inventory without API bind settings", () => {
    expect(parseWorkerEnvironment({ ...validEnvironment, API_HOST: undefined, API_PORT: undefined })).toMatchObject({
      appEnvironment: "local",
      databaseUrl: validEnvironment.DATABASE_URL,
      redisUrl: validEnvironment.REDIS_URL,
    });
  });

  it("accepts a shutdown drain longer than the port-number range", () => {
    expect(parseWorkerEnvironment({ ...validEnvironment, SHUTDOWN_TIMEOUT_MS: "120000" })).toMatchObject({
      shutdownTimeoutMilliseconds: 120_000,
    });
  });

  it("allows deployed environments without a source revision", () => {
    expect(parseRuntimeEnvironment({ ...validEnvironment, APP_ENV: "uat", RESEND_API_KEY: "uat-key" })).toMatchObject({
      appEnvironment: "uat",
    });
    expect(
      parseRuntimeEnvironment({
        ...validEnvironment,
        APP_ENV: "uat",
        RESEND_API_KEY: "uat-key",
        SOURCE_REVISION: "a".repeat(40),
      }),
    ).toMatchObject({ sourceRevision: "a".repeat(40) });
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, SOURCE_REVISION: "main" })).toThrow(
      /SOURCE_REVISION must be a full hexadecimal source revision/,
    );
  });

  it("rejects a shutdown drain longer than 24 hours", () => {
    expect(() => parseWorkerEnvironment({ ...validEnvironment, SHUTDOWN_TIMEOUT_MS: "86400001" })).toThrow(
      /SHUTDOWN_TIMEOUT_MS must be an integer from 1 through 86400000/,
    );
  });

  it.each(["foo..bar", "192.168.5.4"])("rejects an invalid storage bucket name: %s", (bucket) => {
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, STORAGE_BUCKET: bucket })).toThrow(
      /STORAGE_BUCKET must be a valid lowercase S3 bucket name/,
    );
  });

  it("names invalid variables without echoing their values", () => {
    const secretValue = "do-not-echo-this-value";
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, DATABASE_URL: secretValue })).toThrow(
      EnvironmentValidationError,
    );
    try {
      parseRuntimeEnvironment({ ...validEnvironment, DATABASE_URL: secretValue });
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain(secretValue);
    }
  });

  it.each(["postgresql:pickflick_local", "postgresql:///pickflick_local"])(
    "rejects a database URL without a host: %s",
    (databaseUrl) => {
      expect(() => parseDatabaseEnvironment({ ...validEnvironment, DATABASE_URL: databaseUrl })).toThrow(
        /DATABASE_URL must include a host/,
      );
    },
  );

  it("rejects a database URL without a database name", () => {
    expect(() =>
      parseDatabaseEnvironment({ ...validEnvironment, DATABASE_URL: "postgresql://127.0.0.1" }),
    ).toThrow(/DATABASE_URL must include a database name/);
  });

  it.each(["redis:0", "redis:///0"])("rejects a Redis URL without a host: %s", (redisUrl) => {
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, REDIS_URL: redisUrl })).toThrow(
      /REDIS_URL must include a host/,
    );
  });

  it("reports every missing required variable in one safe failure", () => {
    expect(() => parseRuntimeEnvironment({})).toThrow(/APP_ENV is required; API_HOST is required/);
  });
});
