import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const UAT_BASE_URL = "https://uat.pick-flick.app";
export const UAT_DEFAULT_REF = "main";
export const UAT_RESTORE_TAG_PREFIX = "PF-uat-";
export const DOKPLOY_COMPOSE_PATH = "compose.deploy.yaml";
export const DOKPLOY_DEPLOY_COMMAND =
  "compose -f compose.deploy.yaml --profile release run --build --rm release && docker compose -f compose.deploy.yaml --profile application up --build -d --wait --remove-orphans";

const githubRepository = "Shagon1k/PickFlick";
const revisionPattern = /^[0-9a-f]{40}$/i;
const composeIdPattern = /^[A-Za-z0-9_-]+$/;
const expectedReadinessDependencies = ["database", "redis", "objectStorage"];
const referencedVariables = [
  "DATABASE_URL",
  "DOKPLOY_NETWORK",
  "REDIS_URL",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "STORAGE_ACCESS_KEY",
  "STORAGE_BUCKET",
  "STORAGE_ENDPOINT",
  "STORAGE_FORCE_PATH_STYLE",
  "STORAGE_REGION",
  "STORAGE_SECRET_KEY",
];

function required(source, name) {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function requiredBoolean(source, name) {
  const value = required(source, name);
  if (value !== "true" && value !== "false") {
    throw new Error(`${name} must be true or false.`);
  }
  return value === "true";
}

export function validateRevision(revision) {
  if (!revisionPattern.test(revision)) {
    throw new Error("SOURCE_REVISION must be a full 40-character hexadecimal Git revision.");
  }
  return revision.toLowerCase();
}

export function validateDokployUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DOKPLOY_URL must be a valid HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("DOKPLOY_URL must be an HTTPS origin without credentials, a path, a query, or a fragment.");
  }
  return url.origin;
}

export function dokployEnvironment(revision) {
  const lines = ["APP_ENV=uat", `SOURCE_REVISION=${validateRevision(revision)}`];
  for (const name of referencedVariables) {
    lines.push(`${name}=\${{environment.${name}}}`);
  }
  return `${lines.join("\n")}\n`;
}

function requestHeaders(authentication) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...authentication,
  };
}

function dokployAuthentication(configuration) {
  return {
    "CF-Access-Client-Id": configuration.cloudflareAccessClientId,
    "CF-Access-Client-Secret": configuration.cloudflareAccessClientSecret,
    "x-api-key": configuration.dokployApiToken,
  };
}

async function requestJson(fetchImplementation, url, options, acceptedStatuses = [200]) {
  let response;
  try {
    response = await fetchImplementation(url, {
      ...options,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`Request to ${new URL(url).pathname} failed.`, { cause: error });
  }

  if (!acceptedStatuses.includes(response.status)) {
    throw new Error(`Request to ${new URL(url).pathname} returned HTTP ${response.status}.`);
  }
  if (response.status === 404) {
    return undefined;
  }
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Request to ${new URL(url).pathname} did not return JSON.`);
  }
  return response.json();
}

function githubUrl(path) {
  return new URL(path, "https://api.github.com").href;
}

function dokployUrl(origin, path) {
  return new URL(path, `${origin}/`).href;
}

async function verifyDokployCompose(fetchImplementation, configuration) {
  const compose = await requestJson(
    fetchImplementation,
    dokployUrl(configuration.dokployOrigin, `/api/compose.one?composeId=${encodeURIComponent(configuration.composeId)}`),
    { headers: requestHeaders(dokployAuthentication(configuration)) },
  );

  const failures = [];
  if (compose.sourceType !== "github") {
    failures.push("sourceType=github");
  }
  if (compose.owner !== "Shagon1k" || compose.repository !== "PickFlick") {
    failures.push(`repository=${githubRepository}`);
  }
  if (compose.autoDeploy !== false) {
    failures.push("autoDeploy=false");
  }
  if (compose.composeType !== "docker-compose") {
    failures.push("composeType=docker-compose");
  }
  if (compose.composePath !== DOKPLOY_COMPOSE_PATH) {
    failures.push(`composePath=${DOKPLOY_COMPOSE_PATH}`);
  }
  if (compose.command?.trim() !== DOKPLOY_DEPLOY_COMMAND) {
    failures.push("the staged release/application deploy command");
  }
  if (failures.length) {
    throw new Error(`The Dokploy Compose resource does not match the UAT contract: ${failures.join(", ")}.`);
  }
  if (typeof compose.composeStatus !== "string" || !compose.composeStatus) {
    throw new Error("The Dokploy Compose resource did not report a deployment status.");
  }
  if (compose.composeStatus === "running") {
    throw new Error("The Dokploy Compose resource already has a running deployment.");
  }
  dokployDeploymentRecords(compose);
  return compose;
}

function dokployDeploymentRecords(compose) {
  if (!Array.isArray(compose.deployments)) {
    throw new Error("The Dokploy Compose resource did not report deployment records.");
  }
  for (const deployment of compose.deployments) {
    if (typeof deployment?.deploymentId !== "string" || !deployment.deploymentId) {
      throw new Error("The Dokploy Compose resource reported an invalid deployment record.");
    }
  }
  return compose.deployments;
}

export function uatRestoreTag(revision) {
  return `${UAT_RESTORE_TAG_PREFIX}${validateRevision(revision)}`;
}

async function ensureUatTag(fetchImplementation, configuration) {
  const tag = uatRestoreTag(configuration.revision);
  const encodedTag = encodeURIComponent(tag);
  const refUrl = githubUrl(`/repos/${githubRepository}/git/ref/tags/${encodedTag}`);
  const authentication = { Authorization: `Bearer ${configuration.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" };
  const existing = await requestJson(fetchImplementation, refUrl, { headers: requestHeaders(authentication) }, [200, 404]);

  if (existing?.object?.sha?.toLowerCase() === configuration.revision) {
    return tag;
  }

  if (existing === undefined) {
    const created = await requestJson(fetchImplementation, githubUrl(`/repos/${githubRepository}/git/refs`), {
      method: "POST",
      headers: requestHeaders(authentication),
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: configuration.revision }),
    }, [201]);
    if (created?.object?.sha?.toLowerCase() !== configuration.revision) {
      throw new Error("GitHub did not confirm the requested immutable UAT tag.");
    }
    return tag;
  }

  throw new Error("The requested immutable UAT tag already points to another revision.");
}

async function pinDokployRef(fetchImplementation, configuration, currentBranch) {
  const branch = await ensureUatTag(fetchImplementation, configuration);
  if (currentBranch === branch) {
    return;
  }
  const updated = await requestJson(fetchImplementation, dokployUrl(configuration.dokployOrigin, "/api/compose.update"), {
    method: "POST",
    headers: requestHeaders(dokployAuthentication(configuration)),
    body: JSON.stringify({ autoDeploy: false, branch, composeId: configuration.composeId }),
  });
  if (updated?.branch !== branch) {
    throw new Error("Dokploy did not retain the requested UAT Git ref.");
  }
}

async function saveDokployEnvironment(fetchImplementation, configuration) {
  await requestJson(fetchImplementation, dokployUrl(configuration.dokployOrigin, "/api/compose.saveEnvironment"), {
    method: "POST",
    headers: requestHeaders(dokployAuthentication(configuration)),
    body: JSON.stringify({
      composeId: configuration.composeId,
      createEnvFile: true,
      env: dokployEnvironment(configuration.revision),
    }),
  });
}

async function triggerDokploy(fetchImplementation, configuration) {
  const deployment = await requestJson(fetchImplementation, dokployUrl(configuration.dokployOrigin, "/api/compose.deploy"), {
    method: "POST",
    headers: requestHeaders(dokployAuthentication(configuration)),
    body: JSON.stringify({
      composeId: configuration.composeId,
      description: `Automated UAT deployment for ${githubRepository}@${configuration.revision}`,
      freshVolumes: false,
      title: `PickFlick UAT ${configuration.revision.slice(0, 12)}`,
    }),
  });
  if (deployment?.success !== true || deployment.composeId !== configuration.composeId) {
    throw new Error("Dokploy did not confirm the requested UAT deployment.");
  }
}

export async function waitForDokployDeployment(
  configuration,
  previousDeploymentIds,
  { fetchImplementation = fetch, intervalMilliseconds = 5_000, sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)), timeoutMilliseconds = 15 * 60_000 } = {},
) {
  const deadline = Date.now() + timeoutMilliseconds;
  let deploymentId;
  while (Date.now() < deadline) {
    const compose = await requestJson(
      fetchImplementation,
      dokployUrl(configuration.dokployOrigin, `/api/compose.one?composeId=${encodeURIComponent(configuration.composeId)}`),
      { headers: requestHeaders(dokployAuthentication(configuration)) },
    );
    const deployments = dokployDeploymentRecords(compose);
    if (deploymentId === undefined) {
      const newDeployments = deployments.filter(({ deploymentId: candidateId }) => !previousDeploymentIds.has(candidateId));
      if (newDeployments.length > 1) {
        throw new Error("Dokploy reported multiple new deployments; the requested UAT deployment is ambiguous.");
      }
      deploymentId = newDeployments[0]?.deploymentId;
    }
    const deployment = deployments.find(({ deploymentId: candidateId }) => candidateId === deploymentId);
    switch (deployment?.status) {
      case "done":
        return;
      case "error":
      case "cancelled":
        throw new Error("Dokploy reported a failed UAT deployment.");
      case "running":
      case undefined:
        break;
      default:
        throw new Error("Dokploy reported an unexpected UAT deployment status.");
    }
    if (compose.composeStatus === "error") {
      throw new Error("Dokploy reported a failed UAT deployment.");
    }
    if (!["done", "idle", "running"].includes(compose.composeStatus)) {
      throw new Error("Dokploy reported an unexpected UAT deployment status.");
    }
    await sleep(intervalMilliseconds);
  }
  throw new Error(`Dokploy did not complete the UAT deployment within ${timeoutMilliseconds}ms.`);
}

async function fetchHealth(fetchImplementation, pathname) {
  try {
    const response = await fetchImplementation(new URL(pathname, UAT_BASE_URL), {
      headers: { Accept: "application/json", "Cache-Control": "no-store" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
      return undefined;
    }
    return response.json();
  } catch {
    return undefined;
  }
}

export async function waitForUatRevision(
  revision,
  { fetchImplementation = fetch, intervalMilliseconds = 5_000, sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)), timeoutMilliseconds = 20 * 60_000 } = {},
) {
  const expectedRevision = validateRevision(revision);
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const [liveness, readiness] = await Promise.all([
      fetchHealth(fetchImplementation, "/api/health/live"),
      fetchHealth(fetchImplementation, "/api/health/ready"),
    ]);
    const readinessChecks = Array.isArray(readiness?.checks) ? readiness.checks : [];
    const hasExpectedReadinessChecks =
      readinessChecks.length === expectedReadinessDependencies.length &&
      expectedReadinessDependencies.every((name) =>
        readinessChecks.some((check) => check?.name === name && check.status === "up"),
      );
    if (
      liveness?.service === "api" &&
      liveness.status === "alive" &&
      liveness.revision?.toLowerCase() === expectedRevision &&
      readiness?.status === "ready" &&
      hasExpectedReadinessChecks
    ) {
      return;
    }
    await sleep(intervalMilliseconds);
  }
  throw new Error(`UAT did not report ready revision ${expectedRevision} within ${timeoutMilliseconds}ms.`);
}

export function deploymentConfiguration(source = process.env) {
  const repository = required(source, "GITHUB_REPOSITORY");
  if (repository !== githubRepository) {
    throw new Error(`GITHUB_REPOSITORY must be ${githubRepository}.`);
  }
  const composeId = required(source, "DOKPLOY_UAT_COMPOSE_ID");
  if (!composeIdPattern.test(composeId)) {
    throw new Error("DOKPLOY_UAT_COMPOSE_ID has an invalid format.");
  }
  return {
    cloudflareAccessClientId: required(source, "CF_ACCESS_CLIENT_ID"),
    cloudflareAccessClientSecret: required(source, "CF_ACCESS_CLIENT_SECRET"),
    composeId,
    dokployApiToken: required(source, "DOKPLOY_API_TOKEN"),
    dokployOrigin: validateDokployUrl(required(source, "DOKPLOY_URL")),
    restoreRevision: requiredBoolean(source, "UAT_RESTORE_REVISION"),
    githubToken: required(source, "GITHUB_TOKEN"),
    revision: validateRevision(required(source, "SOURCE_REVISION")),
  };
}

export async function deployUat(source = process.env, fetchImplementation = fetch, waitOptions = {}) {
  const configuration = deploymentConfiguration(source);
  const compose = await verifyDokployCompose(fetchImplementation, configuration);
  await pinDokployRef(fetchImplementation, configuration, compose.branch);
  await saveDokployEnvironment(fetchImplementation, configuration);
  const composeBeforeDeployment = await verifyDokployCompose(fetchImplementation, configuration);
  const previousDeploymentIds = new Set(
    dokployDeploymentRecords(composeBeforeDeployment).map(({ deploymentId }) => deploymentId),
  );
  await triggerDokploy(fetchImplementation, configuration);
  await waitForDokployDeployment(configuration, previousDeploymentIds, { ...waitOptions, fetchImplementation });
  await waitForUatRevision(configuration.revision, { ...waitOptions, fetchImplementation });
  return configuration.revision;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const revision = await deployUat();
  console.log(`UAT is ready at ${UAT_BASE_URL} on revision ${revision}.`);
}
