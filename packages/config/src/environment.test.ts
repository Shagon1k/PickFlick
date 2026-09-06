import { describe, expect, it } from "vitest";

import { EnvironmentValidationError, parseDatabaseEnvironment, parseRuntimeEnvironment } from "./environment.js";

const validEnvironment = {
  APP_ENV: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
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

  it("reports every missing required variable in one safe failure", () => {
    expect(() => parseRuntimeEnvironment({})).toThrow(/APP_ENV is required; API_HOST is required/);
  });
});
