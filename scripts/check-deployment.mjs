import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const applicationServices = ["api", "release", "web", "worker"];
const runtimeServices = ["api", "web", "worker"];
const deploymentOverrideVariables = ["DOKPLOY_NETWORK", "SOURCE_REVISION"];
const intendedHealthChecks = {
  api: [
    "CMD",
    "node",
    "-e",
    "fetch('http://127.0.0.1:3001/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
  ],
  web: [
    "CMD",
    "node",
    "-e",
    "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
  ],
};
const runtimeEnvironmentVariables = [
  "APP_ENV",
  "DATABASE_URL",
  "MAIL_FROM",
  "REDIS_URL",
  "S3_ACCESS_KEY_ID",
  "S3_BUCKET",
  "S3_ENDPOINT",
  "S3_FORCE_PATH_STYLE",
  "S3_REGION",
  "S3_SECRET_ACCESS_KEY",
  "SHUTDOWN_TIMEOUT_MS",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SOURCE_REVISION",
];
const apiEnvironmentVariables = [...runtimeEnvironmentVariables, "API_HOST", "API_PORT"];

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

function hasOnlyProfile(service, profile) {
  return service.profiles?.length === 1 && service.profiles[0] === profile;
}

function validateRequiredEnvironment(service, names, serviceName) {
  for (const name of names) {
    const value = service.environment?.[name];
    assert(value !== undefined && value !== null && value !== "", `${serviceName} must receive ${name}.`);
  }
}

function hasEnabledHealthCheck(service) {
  const test = service.healthcheck?.test;
  return (
    service.healthcheck?.disable !== true &&
    Array.isArray(test) &&
    test.length > 1 &&
    (test[0] === "CMD" || test[0] === "CMD-SHELL")
  );
}

function hasIntendedHealthCheck(service, intendedTest) {
  const test = service.healthcheck?.test;
  return Array.isArray(test) && test.length === intendedTest.length && test.every((part, index) => part === intendedTest[index]);
}

function hasUniqueAliasOwners(services) {
  const aliasOwners = new Map();

  for (const name of applicationServices) {
    for (const alias of new Set(services[name].networks.application.aliases)) {
      if (aliasOwners.has(alias)) {
        return false;
      }
      aliasOwners.set(alias, name);
    }
  }

  return true;
}

export function validateDeployments({ production, uat }) {
  for (const [appEnvironment, deployment] of Object.entries({ production, uat })) {
    assert(
      JSON.stringify(Object.keys(deployment.services).sort()) === JSON.stringify(applicationServices),
      "Deployment Compose must contain only api, release, web, and worker.",
    );

    assert(
      deployment.name === `pickflick-${appEnvironment}`,
      `${appEnvironment} must use its own Compose project name.`,
    );

    const selectedRevision = deployment.services.web.environment?.SOURCE_REVISION;
    validateRevision(selectedRevision);

    for (const name of applicationServices) {
      const service = deployment.services[name];
      assert(service.ports === undefined, `${name} must not publish host ports.`);
      assert(service.read_only === true, `${name} must use a read-only root filesystem.`);
      assert(service.init === true, `${name} must use an init process.`);
      assert(service.cap_drop?.includes("ALL"), `${name} must drop Linux capabilities.`);
      assert(service.security_opt?.includes("no-new-privileges:true"), `${name} must prevent new privileges.`);
      assert(service.tmpfs?.includes("/tmp"), `${name} must mount /tmp as tmpfs.`);
      assert(
        service.build?.args?.SOURCE_REVISION === selectedRevision,
        `${name} must build the selected source revision.`,
      );
      assert(
        service.networks?.application?.aliases?.includes(`pickflick-${appEnvironment}-${name}`),
        `${name} must use its environment-specific service alias.`,
      );
    }

    assert(
      hasOnlyProfile(deployment.services.release, "release"),
      "The release gate must use its isolated deployment profile.",
    );
    assert(
      runtimeServices.every((name) => !(name in (deployment.services.release.depends_on ?? {}))),
      "The release gate must not depend on application services.",
    );
    assert(deployment.services.release.build?.target === "release", "The release gate must build the release target.");
    assert(deployment.services.release.command == null, "The release gate must use the image command.");
    assert(deployment.services.release.entrypoint == null, "The release gate must use the image entrypoint.");
    validateRequiredEnvironment(deployment.services.release, ["APP_ENV", "DATABASE_URL"], "release");

    for (const name of runtimeServices) {
      assert(
        hasOnlyProfile(deployment.services[name], "application"),
        `${name} must use the application convergence profile.`,
      );
      assert(deployment.services[name].build?.target === name, `${name} must build the ${name} target.`);
      assert(
        !("release" in (deployment.services[name].depends_on ?? {})),
        `${name} must not recreate before the release run.`,
      );
      assert(
        deployment.services[name].environment?.SOURCE_REVISION === selectedRevision,
        `${name} must report the selected source revision.`,
      );
    }

    validateRequiredEnvironment(deployment.services.api, apiEnvironmentVariables, "api");
    validateRequiredEnvironment(deployment.services.worker, runtimeEnvironmentVariables, "worker");
    assert(deployment.services.release.environment.APP_ENV === appEnvironment, "Release must use the selected environment.");
    assert(deployment.services.api.environment.APP_ENV === appEnvironment, "API must use the selected environment.");
    assert(deployment.services.worker.environment.APP_ENV === appEnvironment, "Worker must use the selected environment.");
    assert(hasEnabledHealthCheck(deployment.services.api), "API must define an enabled health check.");
    assert(hasEnabledHealthCheck(deployment.services.web), "Web must define an enabled health check.");
    assert(
      hasIntendedHealthCheck(deployment.services.api, intendedHealthChecks.api),
      "API must define its intended health check.",
    );
    assert(
      hasIntendedHealthCheck(deployment.services.web, intendedHealthChecks.web),
      "Web must define its intended health check.",
    );
    assert(deployment.services.web.depends_on?.api?.condition === "service_healthy", "Web must wait for API health.");
    assert(deployment.services.web.depends_on?.api?.required === true, "Web must require API health.");
    assert(hasUniqueAliasOwners(deployment.services), `${appEnvironment} service aliases must each have one owner.`);
  }

  const uatAliases = applicationServices.flatMap(
    (name) => uat.services[name].networks.application.aliases,
  );
  const productionAliases = new Set(
    applicationServices.flatMap((name) => production.services[name].networks.application.aliases),
  );
  assert(
    !uatAliases.some((alias) => productionAliases.has(alias)),
    "UAT and production service aliases must be environment-isolated.",
  );

  return { production, uat };
}

export function checkDeployment() {
  const deployments = {
    production: renderDeployment("production", {}),
    uat: renderDeployment("uat", {}),
  };

  return validateDeployments(deployments);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  checkDeployment();
  console.log("Deployment Compose valid for proportional UAT and production scopes.");
}
