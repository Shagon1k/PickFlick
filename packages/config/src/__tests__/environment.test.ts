import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parseDatabaseEnvironment,
  parseRuntimeEnvironment,
  parseWorkerEnvironment,
} from "../environment.js";

const validEnvironment = {
  APP_ENV: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
  SHUTDOWN_TIMEOUT_MS: "10000",
  DATABASE_URL: "postgresql://pickflick:local-password@127.0.0.1:5432/pickflick_local",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "pickflick-local",
  S3_ACCESS_KEY_ID: "local-access-key",
  S3_SECRET_ACCESS_KEY: "local-secret-key",
  S3_FORCE_PATH_STYLE: "true",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  MAIL_FROM: "PickFlick <pickflick@example.invalid>",
} as const;

describe("environment validation", () => {
  it("parses the typed runtime inventory", () => {
    expect(parseRuntimeEnvironment(validEnvironment)).toMatchObject({
      appEnvironment: "local",
      apiPort: 3001,
      shutdownTimeoutMilliseconds: 10_000,
      s3: { forcePathStyle: true },
      smtp: { port: 1025, secure: false },
    });
  });

  it("accepts the focused database inventory", () => {
    expect(parseDatabaseEnvironment(validEnvironment)).toEqual({
      appEnvironment: "local",
      databaseUrl: validEnvironment.DATABASE_URL,
    });
  });

  it("accepts the worker inventory without API bind settings", () => {
    expect(parseWorkerEnvironment({ ...validEnvironment, API_HOST: undefined, API_PORT: undefined })).toMatchObject({
      appEnvironment: "local",
      databaseUrl: validEnvironment.DATABASE_URL,
      redisUrl: validEnvironment.REDIS_URL,
    });
  });

  it.each(["foo..bar", "192.168.5.4"])("rejects an invalid S3 bucket name: %s", (bucket) => {
    expect(() => parseRuntimeEnvironment({ ...validEnvironment, S3_BUCKET: bucket })).toThrow(
      /S3_BUCKET must be a valid lowercase S3 bucket name/,
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
