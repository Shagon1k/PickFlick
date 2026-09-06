import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";
import { createHash, createHmac } from "node:crypto";

import type { WorkerEnvironment } from "@pickflick/config/environment";
import type { DependencyName, ReadinessReport } from "@pickflick/contracts";

export interface DependencyProbe {
  readonly name: DependencyName;
  readonly check: () => Promise<void>;
}

interface ProbeOptions {
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly timeoutMilliseconds?: number;
}

const defaultTimeoutMilliseconds = 2_000;

async function runBounded(check: () => Promise<void>, timeoutMilliseconds: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Dependency readiness check timed out.")), timeoutMilliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkReadiness(
  probes: readonly DependencyProbe[],
  timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<ReadinessReport> {
  const checks = await Promise.all(
    probes.map(async ({ name, check }) => {
      try {
        await runBounded(check, timeoutMilliseconds);
        return { name, status: "up" as const };
      } catch {
        return { name, status: "down" as const };
      }
    }),
  );

  return {
    status: checks.every(({ status }) => status === "up") ? "ready" : "not_ready",
    checks,
  };
}

function redisCommand(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

export async function checkRedis(redisUrl: string, timeoutMilliseconds = defaultTimeoutMilliseconds): Promise<void> {
  const target = new URL(redisUrl);
  const secure = target.protocol === "rediss:";
  const port = Number(target.port || (secure ? 6380 : 6379));

  await new Promise<void>((resolve, reject) => {
    const socket = secure
      ? connectTls({ host: target.hostname, port, servername: target.hostname })
      : connectTcp({ host: target.hostname, port });
    const timer = setTimeout(() => socket.destroy(new Error("Redis readiness check timed out.")), timeoutMilliseconds);
    let response = "";

    const finish = (error?: Error) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.once(secure ? "secureConnect" : "connect", () => {
      const commands: string[] = [];
      if (target.password) {
        const username = decodeURIComponent(target.username || "default");
        commands.push(redisCommand(["AUTH", username, decodeURIComponent(target.password)]));
      }
      commands.push(redisCommand(["PING"]));
      socket.write(commands.join(""));
    });
    socket.on("data", (data) => {
      response += data.toString("utf8");
      if (response.includes("-ERR")) finish(new Error("Redis readiness check was rejected."));
      else if (response.endsWith("+PONG\r\n")) finish();
    });
    socket.once("error", () => finish(new Error("Redis readiness check failed.")));
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function bucketUrl(configuration: WorkerEnvironment["s3"]): URL {
  const target = new URL(configuration.endpoint);
  if (configuration.forcePathStyle) {
    target.pathname = `${target.pathname.replace(/\/+$/, "")}/${configuration.bucket}`;
  } else {
    target.hostname = `${configuration.bucket}.${target.hostname}`;
  }
  return target;
}

function authorizationHeaders(configuration: WorkerEnvironment["s3"], target: URL, now: Date): Headers {
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = timestamp.slice(0, 8);
  const payloadHash = sha256("");
  const canonicalHeaders = `host:${target.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["HEAD", target.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${date}/${configuration.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, credentialScope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${configuration.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, configuration.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign).toString("hex");

  return new Headers({
    authorization:
      `AWS4-HMAC-SHA256 Credential=${configuration.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  });
}

export async function checkStorage(
  configuration: WorkerEnvironment["s3"],
  options: ProbeOptions = {},
): Promise<void> {
  const target = bucketUrl(configuration);
  const signal = AbortSignal.timeout(options.timeoutMilliseconds ?? defaultTimeoutMilliseconds);

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(target, {
      method: "HEAD",
      headers: authorizationHeaders(configuration, target, options.now ?? new Date()),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new Error("Object storage readiness check timed out.", { cause: error });
    throw error;
  }

  if (!response.ok) throw new Error(`Object storage readiness check failed with HTTP ${response.status}.`);
}

export async function checkSmtp(
  host: string,
  port: number,
  secure: boolean,
  timeoutMilliseconds = defaultTimeoutMilliseconds,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = secure ? connectTls({ host, port, servername: host }) : connectTcp({ host, port });
    const timer = setTimeout(() => socket.destroy(new Error("SMTP readiness check timed out.")), timeoutMilliseconds);

    socket.once("data", (data) => {
      clearTimeout(timer);
      socket.end("QUIT\r\n");
      if (data.toString("utf8").startsWith("220")) resolve();
      else reject(new Error("SMTP readiness check was rejected."));
    });
    socket.once("error", () => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error("SMTP readiness check failed."));
    });
  });
}

export function createRuntimeDependencyProbes(
  environment: WorkerEnvironment,
  checkDatabase: () => Promise<void>,
): readonly DependencyProbe[] {
  return [
    { name: "database", check: checkDatabase },
    { name: "redis", check: () => checkRedis(environment.redisUrl) },
    { name: "objectStorage", check: () => checkStorage(environment.s3) },
    {
      name: "smtp",
      check: () => checkSmtp(environment.smtp.host, environment.smtp.port, environment.smtp.secure),
    },
  ];
}
