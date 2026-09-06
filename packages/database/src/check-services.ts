import { connect } from "node:net";

import { loadRuntimeEnvironment } from "@pickflick/config/environment";

import { createDatabaseClient } from "./client.js";
import { checkStorage } from "./check-storage.js";

const environment = loadRuntimeEnvironment();

async function checkRedis(redisUrl: string): Promise<void> {
  const target = new URL(redisUrl);
  if (target.protocol !== "redis:") throw new Error("The local service check requires a redis:// URL.");
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host: target.hostname, port: Number(target.port || 6379) });
    const timeout = setTimeout(() => socket.destroy(new Error("Redis check timed out.")), 5_000);
    socket.once("connect", () => socket.write("*1\r\n$4\r\nPING\r\n"));
    socket.once("data", (data) => {
      clearTimeout(timeout);
      socket.end();
      if (data.toString() === "+PONG\r\n") resolve();
      else reject(new Error("Redis did not return PONG."));
    });
    socket.once("error", reject);
  });
}

async function checkSmtp(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    const timeout = setTimeout(() => socket.destroy(new Error("SMTP check timed out.")), 5_000);
    socket.once("data", (data) => {
      clearTimeout(timeout);
      socket.end("QUIT\r\n");
      if (data.toString().startsWith("220")) resolve();
      else reject(new Error("SMTP service did not return a greeting."));
    });
    socket.once("error", reject);
  });
}

const database = createDatabaseClient(environment.databaseUrl);
try {
  await database.$queryRaw`SELECT 1`;
} finally {
  await database.$disconnect();
}
await checkRedis(environment.redisUrl);
await checkStorage(environment.s3);
await checkSmtp(environment.smtp.host, environment.smtp.port);

console.log("Local services reachable: PostgreSQL, Redis, S3-compatible storage, and SMTP.");
