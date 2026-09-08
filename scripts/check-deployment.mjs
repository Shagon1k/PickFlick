import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const applicationServices = ["api", "release", "web", "worker"];
const runtimeServices = ["api", "web", "worker"];
const deploymentOverrideVariables = ["DOKPLOY_NETWORK", "SOURCE_REVISION"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateRevision(revision) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(revision)) {
    throw new Error("SOURCE_REVISION must be a full hexadecimal source revision.");
  }
  return revision;
}

function environmentFor(appEnvironment, source) {
  const environment = {
    APP_ENV: appEnvironment,
    DATABASE_URL: `postgresql://pickflick:synthetic@pickflick-${appEnvironment}-postgres:5432/pickflick_${appEnvironment}`,
    DOKPLOY_NETWORK: `pickflick-${appEnvironment}-application`,
    MAIL_FROM: "PickFlick <pickflick@example.invalid>",
    REDIS_URL: `redis://:synthetic@pickflick-${appEnvironment}-redis:6379/0`,
    S3_ACCESS_KEY_ID: `pickflick-${appEnvironment}`,
    S3_BUCKET: `pickflick-${appEnvironment}`,
    S3_ENDPOINT: `https://objects-${appEnvironment}.example.invalid`,
    S3_FORCE_PATH_STYLE: "false",
    S3_REGION: "us-east-1",
    S3_SECRET_ACCESS_KEY: "synthetic-storage-secret",
    SHUTDOWN_TIMEOUT_MS: "10000",
    SMTP_HOST: `smtp-${appEnvironment}.example.invalid`,
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SOURCE_REVISION: "a".repeat(40),
  };

  for (const name of deploymentOverrideVariables) {
    if (source[name] !== undefined) {
      environment[name] = source[name].trim();
    }
  }

  validateRevision(environment.SOURCE_REVISION);
  return environment;
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
  const uat = renderDeployment("uat", {});
  const production = renderDeployment("production", {});

  for (const deployment of [uat, production]) {
    assert(
      JSON.stringify(Object.keys(deployment.services).sort()) === JSON.stringify(applicationServices),
      "Deployment Compose must contain only api, release, web, and worker.",
    );
    assert(deployment.volumes === undefined, "Deployment Compose must not own data volumes.");
    assert(
      Object.keys(deployment.networks).length === 1 && deployment.networks.application.external === true,
      "Application services must use one external Dokploy network.",
    );

    for (const name of applicationServices) {
      const service = deployment.services[name];
      assert(service.ports === undefined, `${name} must not publish host ports.`);
      assert(service.read_only === true, `${name} must use a read-only root filesystem.`);
      assert(service.init === true, `${name} must use an init process.`);
      assert(service.cap_drop.includes("ALL"), `${name} must drop Linux capabilities.`);
      assert(service.security_opt.includes("no-new-privileges:true"), `${name} must prevent new privileges.`);
      assert(service.tmpfs.includes("/tmp"), `${name} must mount /tmp as tmpfs.`);
      assert(service.build.dockerfile === "Dockerfile", `${name} must build from the repository Dockerfile.`);
      assert(service.build.target === name, `${name} must build its matching Dockerfile target.`);
      assert(
        service.build.args.SOURCE_REVISION === deployment.services.web.environment.SOURCE_REVISION,
        `${name} must build the selected source revision.`,
      );
      assert(
        service.networks.application.aliases.includes(`pickflick-${deployment.services.release.environment.APP_ENV}-${name}`),
        `${name} must use its environment-specific service alias.`,
      );
    }

    for (const name of ["api", "worker"]) {
      assert(
        deployment.services[name].environment.SHUTDOWN_TIMEOUT_MS === "10000",
        `${name} shutdown timeout must remain below the 15-second Compose stop grace.`,
      );
      assert(deployment.services[name].stop_grace_period === "15s", `${name} must retain the 15-second stop grace.`);
    }

    assert(
      deployment.services.release.profiles.length === 1 && deployment.services.release.profiles[0] === "release",
      "The release gate must use its isolated deployment profile.",
    );
    for (const name of runtimeServices) {
      assert(
        deployment.services[name].profiles.length === 1 && deployment.services[name].profiles[0] === "application",
        `${name} must use the application convergence profile.`,
      );
      assert(
        !("release" in (deployment.services[name].depends_on ?? {})),
        `${name} must not recreate before the release run.`,
      );
      assert(
        deployment.services[name].environment.SOURCE_REVISION === deployment.services.web.environment.SOURCE_REVISION,
        `${name} must report the selected source revision.`,
      );
    }
    assert(deployment.services.web.depends_on.api.condition === "service_healthy", "Web must wait for API health.");
  }

  assert(uat.name === "pickflick-uat", "UAT must use its own Compose project name.");
  assert(production.name === "pickflick-production", "Production must use its own Compose project name.");
  assert(uat.networks.application.name !== production.networks.application.name, "Application networks must be isolated.");
  for (const name of applicationServices) {
    assert(
      uat.services[name].networks.application.aliases[0] !==
        production.services[name].networks.application.aliases[0],
      `${name} service aliases must be environment-isolated.`,
    );
  }
  assert(uat.services.api.environment.DATABASE_URL !== production.services.api.environment.DATABASE_URL, "Database URLs must be isolated.");
  assert(uat.services.api.environment.REDIS_URL !== production.services.api.environment.REDIS_URL, "Redis URLs must be isolated.");
  assert(uat.services.api.environment.S3_BUCKET !== production.services.api.environment.S3_BUCKET, "S3 buckets must be isolated.");

  return { production, uat };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  checkDeployment();
  console.log("Deployment Compose valid for proportional UAT and production scopes.");
}
