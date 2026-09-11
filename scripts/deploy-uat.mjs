import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const UAT_BASE_URL = "https://uat.pick-flick.app";
export const UAT_DEFAULT_REF = "main";
export const DOKPLOY_COMPOSE_PATH = "compose.deploy.yaml";

const githubRepository = "Shagon1k/PickFlick";
const composeIdPattern = /^[A-Za-z0-9_-]+$/;
const revisionPattern = /^[0-9a-f]{40}$/;
const expectedReadinessDependencies = ["database", "redis", "objectStorage"];

function required(source, name) {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function validateRevision(value) {
  const revision = value?.trim().toLowerCase();
  if (!revisionPattern.test(revision ?? "")) {
    throw new Error("SOURCE_REVISION must be a full 40-character hexadecimal Git SHA.");
  }
  return revision;
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
  if (response.status === 204) {
    return undefined;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Request to ${new URL(url).pathname} did not return JSON.`);
  }
  return response.json();
}

function dokployUrl(origin, path) {
  return new URL(path, `${origin}/`).href;
}

export function canonicalComposePath(path) {
  return typeof path === "string" ? path.trim().replace(/^\.\/+/, "") : path;
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
  if (compose.branch !== UAT_DEFAULT_REF) {
    failures.push(`branch=${UAT_DEFAULT_REF}`);
  }
  if (compose.autoDeploy !== false) {
    failures.push("autoDeploy=false");
  }
  if (compose.composeType !== "docker-compose") {
    failures.push("composeType=docker-compose");
  }
  if (canonicalComposePath(compose.composePath) !== DOKPLOY_COMPOSE_PATH) {
    failures.push(`composePath=${DOKPLOY_COMPOSE_PATH}`);
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

async function triggerDokploy(fetchImplementation, configuration) {
  const deployment = await requestJson(fetchImplementation, dokployUrl(configuration.dokployOrigin, "/api/compose.deploy"), {
    method: "POST",
    headers: requestHeaders(dokployAuthentication(configuration)),
    body: JSON.stringify({
      composeId: configuration.composeId,
      description: `Automated UAT deployment for ${githubRepository}@${configuration.sourceRevision}`,
      freshVolumes: false,
      title: `PickFlick UAT ${configuration.sourceRevision.slice(0, 12)}`,
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
        if (deployment.description === `Commit: ${configuration.sourceRevision}`) {
          return deploymentId;
        }
        if (/^Commit: [0-9a-f]{40}$/i.test(deployment.description ?? "")) {
          throw new Error("Dokploy deployed a different UAT source revision than requested.");
        }
        break;
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

export async function waitForUatReadiness(
  expectedRevision,
  { fetchImplementation = fetch, intervalMilliseconds = 5_000, sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)), timeoutMilliseconds = 20 * 60_000 } = {},
) {
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
      liveness.revision === expectedRevision &&
      readiness?.status === "ready" &&
      hasExpectedReadinessChecks
    ) {
      return;
    }
    await sleep(intervalMilliseconds);
  }
  throw new Error(`UAT did not report ready dependencies within ${timeoutMilliseconds}ms.`);
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
    sourceRevision: validateRevision(required(source, "SOURCE_REVISION")),
  };
}

export async function deployUat(source = process.env, fetchImplementation = fetch, waitOptions = {}) {
  const configuration = deploymentConfiguration(source);
  const compose = await verifyDokployCompose(fetchImplementation, configuration);
  const previousDeploymentIds = new Set(dokployDeploymentRecords(compose).map(({ deploymentId }) => deploymentId));
  await triggerDokploy(fetchImplementation, configuration);
  await waitForDokployDeployment(configuration, previousDeploymentIds, { ...waitOptions, fetchImplementation });
  await waitForUatReadiness(configuration.sourceRevision, { ...waitOptions, fetchImplementation });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await deployUat();
  console.log(`UAT is ready at ${UAT_BASE_URL}.`);
}
