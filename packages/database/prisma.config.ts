import { isAbsolute, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { defineConfig } from "prisma/config";

const packageRoot = fileURLToPath(new URL("./", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");
const configuredEnvironmentFile = process.env.PICKFLICK_ENV_FILE?.trim();
const environmentFile = configuredEnvironmentFile
  ? isAbsolute(configuredEnvironmentFile)
    ? configuredEnvironmentFile
    : resolve(repositoryRoot, configuredEnvironmentFile)
  : resolve(repositoryRoot, ".env");

try {
  loadEnvFile(environmentFile);
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT" || configuredEnvironmentFile) {
    throw error;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@127.0.0.1:1/invalid",
  },
});
