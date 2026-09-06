import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPLOYMENT_ENVIRONMENTS = ["local", "test", "uat", "production"] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export interface RuntimeEnvironment {
  readonly appEnvironment: DeploymentEnvironment;
  readonly apiHost: string;
  readonly apiPort: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly s3: {
    readonly endpoint: string;
    readonly region: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly forcePathStyle: boolean;
  };
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly from: string;
  };
}

export type WorkerEnvironment = Omit<RuntimeEnvironment, "apiHost" | "apiPort">;

export interface DatabaseEnvironment {
  readonly appEnvironment: DeploymentEnvironment;
  readonly databaseUrl: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

interface ValidationFailure {
  readonly name: string;
  readonly reason: string;
}

export class EnvironmentValidationError extends Error {
  readonly failures: readonly ValidationFailure[];

  constructor(failures: readonly ValidationFailure[]) {
    super(`Invalid environment configuration: ${failures.map(({ name, reason }) => `${name} ${reason}`).join("; ")}`);
    this.name = "EnvironmentValidationError";
    this.failures = failures;
  }
}

function required(source: EnvironmentSource, name: string, failures: ValidationFailure[]): string {
  const value = source[name]?.trim();
  if (!value) {
    failures.push({ name, reason: "is required" });
    return "";
  }
  return value;
}

function oneOf<T extends readonly string[]>(
  source: EnvironmentSource,
  name: string,
  values: T,
  failures: ValidationFailure[],
): T[number] {
  const value = required(source, name, failures);
  if (value && !values.includes(value)) failures.push({ name, reason: `must be one of ${values.join(", ")}` });
  return value as T[number];
}

function integer(source: EnvironmentSource, name: string, failures: ValidationFailure[]): number {
  const value = required(source, name, failures);
  const parsed = Number(value);
  if (value && (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535)) {
    failures.push({ name, reason: "must be an integer from 1 through 65535" });
  }
  return parsed;
}

function boolean(source: EnvironmentSource, name: string, failures: ValidationFailure[]): boolean {
  const value = required(source, name, failures);
  if (value && value !== "true" && value !== "false") failures.push({ name, reason: "must be true or false" });
  return value === "true";
}

function url(
  source: EnvironmentSource,
  name: string,
  protocols: readonly string[],
  failures: ValidationFailure[],
  structure?: "host" | "host-and-path",
): string {
  const value = required(source, name, failures);
  if (!value) return value;
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) failures.push({ name, reason: `must use ${protocols.join(" or ")}` });
    if (structure && !parsed.hostname) failures.push({ name, reason: "must include a host" });
    if (structure === "host-and-path" && (!parsed.pathname || parsed.pathname === "/")) {
      failures.push({ name, reason: "must include a database name" });
    }
  } catch {
    failures.push({ name, reason: "must be a valid URL" });
  }
  return value;
}

export function parseDatabaseEnvironment(source: EnvironmentSource): DatabaseEnvironment {
  const failures: ValidationFailure[] = [];
  const result: DatabaseEnvironment = {
    appEnvironment: oneOf(source, "APP_ENV", DEPLOYMENT_ENVIRONMENTS, failures),
    databaseUrl: url(source, "DATABASE_URL", ["postgresql:", "postgres:"], failures, "host-and-path"),
  };
  if (failures.length > 0) throw new EnvironmentValidationError(failures);
  return result;
}

function parseWorkerValues(
  source: EnvironmentSource,
  appEnvironment: DeploymentEnvironment,
  failures: ValidationFailure[],
): WorkerEnvironment {
  const databaseUrl = url(source, "DATABASE_URL", ["postgresql:", "postgres:"], failures, "host-and-path");
  const redisUrl = url(source, "REDIS_URL", ["redis:", "rediss:"], failures, "host");
  const endpoint = url(source, "S3_ENDPOINT", ["http:", "https:"], failures);
  const region = required(source, "S3_REGION", failures);
  const bucket = required(source, "S3_BUCKET", failures);
  const accessKeyId = required(source, "S3_ACCESS_KEY_ID", failures);
  const secretAccessKey = required(source, "S3_SECRET_ACCESS_KEY", failures);
  const forcePathStyle = boolean(source, "S3_FORCE_PATH_STYLE", failures);
  const smtpHost = required(source, "SMTP_HOST", failures);
  const smtpPort = integer(source, "SMTP_PORT", failures);
  const smtpSecure = boolean(source, "SMTP_SECURE", failures);
  const from = required(source, "MAIL_FROM", failures);

  if (
    bucket &&
    (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
      bucket.includes("..") ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(bucket))
  ) {
    failures.push({ name: "S3_BUCKET", reason: "must be a valid lowercase S3 bucket name" });
  }
  if (from && !/^[^@\s]+(?:\s+<[^@\s]+@[^@\s]+\.[^@\s]+>|@[^@\s]+\.[^@\s]+)$/.test(from)) {
    failures.push({ name: "MAIL_FROM", reason: "must be an email address or a name plus email address" });
  }
  return {
    appEnvironment,
    databaseUrl,
    redisUrl,
    s3: { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle },
    smtp: { host: smtpHost, port: smtpPort, secure: smtpSecure, from },
  };
}

export function parseWorkerEnvironment(source: EnvironmentSource): WorkerEnvironment {
  const failures: ValidationFailure[] = [];
  const appEnvironment = oneOf(source, "APP_ENV", DEPLOYMENT_ENVIRONMENTS, failures);
  const result = parseWorkerValues(source, appEnvironment, failures);
  if (failures.length > 0) throw new EnvironmentValidationError(failures);
  return result;
}

export function parseRuntimeEnvironment(source: EnvironmentSource): RuntimeEnvironment {
  const failures: ValidationFailure[] = [];
  const appEnvironment = oneOf(source, "APP_ENV", DEPLOYMENT_ENVIRONMENTS, failures);
  const apiHost = required(source, "API_HOST", failures);
  const apiPort = integer(source, "API_PORT", failures);
  const workerEnvironment = parseWorkerValues(source, appEnvironment, failures);

  if (apiHost && /\s/.test(apiHost)) failures.push({ name: "API_HOST", reason: "must not contain whitespace" });
  if (failures.length > 0) throw new EnvironmentValidationError(failures);

  return { ...workerEnvironment, apiHost, apiPort };
}

export function loadRepositoryEnvironmentFile(source: EnvironmentSource = process.env): void {
  const configuredPath = source.PICKFLICK_ENV_FILE?.trim();
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const environmentPath = configuredPath
    ? isAbsolute(configuredPath)
      ? configuredPath
      : resolve(repositoryRoot, configuredPath)
    : resolve(repositoryRoot, ".env");

  try {
    process.loadEnvFile(environmentPath);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT" && !configuredPath) return;
    throw new EnvironmentValidationError([
      { name: "PICKFLICK_ENV_FILE", reason: code === "ENOENT" ? "does not exist" : "could not be loaded" },
    ]);
  }
}

export function loadDatabaseEnvironment(): DatabaseEnvironment {
  loadRepositoryEnvironmentFile();
  return parseDatabaseEnvironment(process.env);
}

export function loadRuntimeEnvironment(): RuntimeEnvironment {
  loadRepositoryEnvironmentFile();
  return parseRuntimeEnvironment(process.env);
}

export function loadWorkerEnvironment(): WorkerEnvironment {
  loadRepositoryEnvironmentFile();
  return parseWorkerEnvironment(process.env);
}
