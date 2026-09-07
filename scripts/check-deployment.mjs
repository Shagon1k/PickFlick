import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = `sha256:${"a".repeat(64)}`;
const applicationImages = ["web", "api", "worker", "release"];
const imageVariables = ["WEB_IMAGE", "API_IMAGE", "WORKER_IMAGE", "RELEASE_IMAGE", "POSTGRES_IMAGE", "REDIS_IMAGE"];
const deploymentOverrideVariables = [...imageVariables, "SHUTDOWN_GRACE_PERIOD", "SHUTDOWN_TIMEOUT_MS"];
const durationUnitsInMilliseconds = new Map([
  ["h", 60 * 60 * 1_000],
  ["m", 60 * 1_000],
  ["s", 1_000],
  ["ms", 1],
  ["us", 1 / 1_000],
  ["µs", 1 / 1_000],
  ["ns", 1 / 1_000_000],
]);

function parseComposeDurationMilliseconds(value) {
  const component = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/gy;
  let milliseconds = 0;
  let matchedLength = 0;
  let match;

  while ((match = component.exec(value)) !== null) {
    milliseconds += Number(match[1]) * durationUnitsInMilliseconds.get(match[2]);
    matchedLength = component.lastIndex;
  }

  if (matchedLength !== value.length || milliseconds <= 0) {
    throw new Error("SHUTDOWN_GRACE_PERIOD must be a positive Compose duration.");
  }
  return milliseconds;
}

function environmentFor(appEnvironment, source) {
  const environment = {
    APP_ENV: appEnvironment,
    API_IMAGE: `registry.invalid/pickflick-api@${digest}`,
    DATABASE_URL: `postgresql://pickflick:synthetic@postgres:5432/pickflick_${appEnvironment}`,
    DOKPLOY_NETWORK: "dokploy-network",
    MAIL_FROM: "PickFlick <pickflick@example.invalid>",
    POSTGRES_DB: `pickflick_${appEnvironment}`,
    POSTGRES_IMAGE: `postgres:17.6-alpine@${digest}`,
    POSTGRES_PASSWORD: "synthetic-postgres-password",
    POSTGRES_USER: "pickflick",
    REDIS_IMAGE: `redis:8.2.1-alpine@${digest}`,
    REDIS_PASSWORD: "synthetic-redis-password",
    REDIS_URL: "redis://:synthetic-redis-password@redis:6379/0",
    RELEASE_IMAGE: `registry.invalid/pickflick-release@${digest}`,
    S3_ACCESS_KEY_ID: `pickflick-${appEnvironment}`,
    S3_BUCKET: `pickflick-${appEnvironment}`,
    S3_ENDPOINT: `https://objects-${appEnvironment}.example.invalid`,
    S3_FORCE_PATH_STYLE: "false",
    S3_REGION: "us-east-1",
    S3_SECRET_ACCESS_KEY: "synthetic-storage-secret",
    SHUTDOWN_GRACE_PERIOD: "15s",
    SHUTDOWN_TIMEOUT_MS: "10000",
    SMTP_HOST: `smtp-${appEnvironment}.example.invalid`,
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SOURCE_REVISION: "a".repeat(40),
    WEB_IMAGE: `registry.invalid/pickflick-web@${digest}`,
    WORKER_IMAGE: `registry.invalid/pickflick-worker@${digest}`,
  };

  for (const name of deploymentOverrideVariables) {
    if (source[name] !== undefined) {
      environment[name] = source[name].trim();
    }
  }

  for (const name of imageVariables) {
    if (!/^[^\s@]+@sha256:[0-9a-f]{64}$/i.test(environment[name])) {
      throw new Error(`${name} must be an immutable image reference pinned by a SHA-256 digest.`);
    }
  }

  const shutdownTimeoutMilliseconds = Number(environment.SHUTDOWN_TIMEOUT_MS);
  if (
    !Number.isInteger(shutdownTimeoutMilliseconds) ||
    shutdownTimeoutMilliseconds < 1 ||
    shutdownTimeoutMilliseconds > 86_400_000
  ) {
    throw new Error("SHUTDOWN_TIMEOUT_MS must be an integer from 1 through 86400000.");
  }
  const shutdownGracePeriodMilliseconds = parseComposeDurationMilliseconds(environment.SHUTDOWN_GRACE_PERIOD);
  if (shutdownGracePeriodMilliseconds <= shutdownTimeoutMilliseconds) {
    throw new Error("SHUTDOWN_GRACE_PERIOD must be greater than SHUTDOWN_TIMEOUT_MS.");
  }

  return environment;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function renderDeployment(appEnvironment, source = process.env) {
  if (appEnvironment !== "uat" && appEnvironment !== "production") {
    throw new Error("Deployment Compose may only render for uat or production.");
  }
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.deploy.yaml",
      "--profile",
      "release",
      "--profile",
      "application",
      "config",
      "--format",
      "json",
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, ...environmentFor(appEnvironment, source) },
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Compose validation failed for ${appEnvironment}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

export function checkDeployment() {
  const uat = renderDeployment("uat");
  const production = renderDeployment("production");

  for (const deployment of [uat, production]) {
    assert(deployment.networks.data.internal === true, "The data network must be internal.");
    assert(deployment.networks.egress.internal !== true, "The egress network must allow outbound traffic.");
    for (const name of ["postgres", "redis"]) {
      assert(!("egress" in deployment.services[name].networks), `${name} must not join the egress network.`);
    }
    for (const [name, service] of Object.entries(deployment.services)) {
      assert(service.ports === undefined, `${name} must not publish host ports.`);
    }
    for (const name of applicationImages) {
      assert(deployment.services[name].read_only === true, `${name} must use a read-only root filesystem.`);
      assert(deployment.services[name].cap_drop.includes("ALL"), `${name} must drop Linux capabilities.`);
    }
    for (const name of [...applicationImages, "postgres", "redis"]) {
      assert(deployment.services[name].image.includes("@sha256:"), `${name} must use an immutable image digest.`);
    }
    assert(
      deployment.services.release.profiles.length === 1 && deployment.services.release.profiles[0] === "release",
      "The release gate must use its isolated deployment profile.",
    );
    for (const name of ["api", "worker", "web"]) {
      assert(
        deployment.services[name].profiles.length === 1 && deployment.services[name].profiles[0] === "application",
        `${name} must use the application convergence profile.`,
      );
      assert(!("release" in deployment.services[name].depends_on), `${name} must not recreate before the release run.`);
    }
    assert(deployment.services.api.depends_on.postgres.condition === "service_healthy", "API must wait for PostgreSQL.");
    assert(deployment.services.worker.depends_on.redis.condition === "service_healthy", "Worker must wait for Redis.");
    assert("data" in deployment.services.worker.networks, "Worker must join the data network.");
    assert("egress" in deployment.services.worker.networks, "Worker must join the egress network.");
  }

  assert(uat.name === "pickflick-uat", "UAT must use its own Compose project name.");
  assert(production.name === "pickflick-production", "Production must use its own Compose project name.");
  assert(uat.networks.data.name !== production.networks.data.name, "Data networks must be environment-isolated.");
  assert(uat.volumes["postgres-data"].name !== production.volumes["postgres-data"].name, "PostgreSQL volumes must be isolated.");
  assert(uat.volumes["redis-data"].name !== production.volumes["redis-data"].name, "Redis volumes must be isolated.");
  assert(uat.services.api.environment.S3_BUCKET !== production.services.api.environment.S3_BUCKET, "S3 buckets must be isolated.");

  return { production, uat };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  checkDeployment();
  console.log("Deployment Compose valid for isolated UAT and production scopes.");
}
