import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_COMPOSE_PATH = "compose.deploy.yaml";
export const PRODUCTION_DEFAULT_REF = "main";
export const UAT_JOB_NAME = "UAT E2E";
export const UAT_WORKFLOW_PATH = ".github/workflows/deploy-uat.yml";

const githubRepository = "Shagon1k/PickFlick";
const uatWorkflowFile = "deploy-uat.yml";
const composeIdPattern = /^[A-Za-z0-9_-]+$/;
const revisionPattern = /^[0-9a-f]{40}$/;
const stableVersionPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseTypes = new Set(["major", "minor", "patch"]);

function required(source, name) {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function validateHttpsOrigin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, a path, a query, or a fragment.`);
  }
  return url.origin;
}

function validateRepository(source) {
  const repository = required(source, "GITHUB_REPOSITORY");
  if (repository !== githubRepository) {
    throw new Error(`GITHUB_REPOSITORY must be ${githubRepository}.`);
  }
  return repository;
}

function validateRevision(value, name = "RELEASE_SHA") {
  const revision = value?.trim().toLowerCase();
  if (!revisionPattern.test(revision ?? "")) {
    throw new Error(`${name} must be a full 40-character hexadecimal Git SHA.`);
  }
  return revision;
}

function validateStableVersion(value) {
  const version = value?.trim();
  if (!stableVersionPattern.test(version ?? "")) {
    throw new Error("RELEASE_VERSION must use stable vMAJOR.MINOR.PATCH SemVer syntax.");
  }
  return version;
}

function defaultGit(arguments_) {
  const result = spawnSync("git", arguments_, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git ${arguments_[0]} failed with exit code ${result.status ?? 1}.`);
  }
  return result.stdout.trim();
}

function requestHeaders(authentication = {}) {
  return {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    ...authentication,
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

function parseVersion(version) {
  const match = stableVersionPattern.exec(version);
  return match ? match.slice(1).map((part) => BigInt(part)) : undefined;
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) {
      return 1;
    }
    if (left[index] < right[index]) {
      return -1;
    }
  }
  return 0;
}

function highestStableVersion(tags) {
  return tags
    .map((tag) => ({ parsed: parseVersion(tag), tag }))
    .filter(({ parsed }) => parsed !== undefined)
    .reduce(
      (current, candidate) =>
        current === undefined || compareVersions(candidate.parsed, current.parsed) > 0 ? candidate : current,
      undefined,
    );
}

export function nextStableVersion(tags, releaseType) {
  if (!releaseTypes.has(releaseType)) {
    throw new Error("RELEASE_TYPE must be patch, minor, or major.");
  }
  const versions = tags.map(parseVersion).filter(Boolean);
  const latest = versions.reduce(
    (current, candidate) => (compareVersions(candidate, current) > 0 ? candidate : current),
    [0n, 0n, 0n],
  );
  let [major, minor, patch] = latest;
  if (releaseType === "major") {
    major += 1n;
    minor = 0n;
    patch = 0n;
  } else if (releaseType === "minor") {
    minor += 1n;
    patch = 0n;
  } else {
    patch += 1n;
  }
  return `v${major}.${minor}.${patch}`;
}

export function resolveRelease(source = process.env, runGit = defaultGit) {
  const releaseType = required(source, "RELEASE_TYPE");
  if (!releaseTypes.has(releaseType)) {
    throw new Error("RELEASE_TYPE must be patch, minor, or major.");
  }
  runGit(["fetch", "--force", "--tags", "origin", "main:refs/remotes/origin/main"]);
  const releaseSha = validateRevision(runGit(["rev-parse", "origin/main"]));
  const tags = runGit(["tag", "--list", "v[0-9]*"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const latest = highestStableVersion(tags);
  if (latest && validateRevision(runGit(["rev-list", "-n", "1", latest.tag]), "release tag revision") === releaseSha) {
    return { releaseSha, releaseVersion: latest.tag };
  }
  return {
    releaseSha,
    releaseVersion: nextStableVersion(tags, releaseType),
  };
}

function githubConfiguration(source) {
  return {
    apiOrigin: validateHttpsOrigin(required(source, "GITHUB_API_URL"), "GITHUB_API_URL"),
    repository: validateRepository(source),
    token: required(source, "GITHUB_TOKEN"),
  };
}

export async function verifyExactUatEvidence(releaseSha, source = process.env, fetchImplementation = fetch) {
  const revision = validateRevision(releaseSha);
  const configuration = githubConfiguration(source);
  const url = new URL(
    `/repos/${configuration.repository}/actions/workflows/${encodeURIComponent(uatWorkflowFile)}/runs`,
    `${configuration.apiOrigin}/`,
  );
  url.searchParams.set("branch", "main");
  url.searchParams.set("head_sha", revision);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("status", "success");

  const result = await requestJson(fetchImplementation, url, {
    headers: requestHeaders({ Authorization: `Bearer ${configuration.token}` }),
  });
  const workflowRuns = Array.isArray(result?.workflow_runs) ? result.workflow_runs : [];
  const matchingRuns = workflowRuns.filter((run) =>
    run?.status === "completed" &&
    run?.conclusion === "success" &&
    run?.head_branch === "main" &&
    run?.head_sha?.toLowerCase() === revision &&
    run?.path === UAT_WORKFLOW_PATH &&
    Number.isSafeInteger(run?.id) &&
    run.id > 0 &&
    run?.head_repository?.full_name === githubRepository,
  );
  if (!matchingRuns.length) {
    throw new Error(`No successful exact UAT workflow evidence exists for ${revision}.`);
  }
  const sortedRuns = matchingRuns.sort(
    (left, right) => String(right.updated_at).localeCompare(String(left.updated_at)),
  );
  for (const run of sortedRuns) {
    const jobsUrl = new URL(
      `/repos/${configuration.repository}/actions/runs/${run.id}/jobs`,
      `${configuration.apiOrigin}/`,
    );
    jobsUrl.searchParams.set("filter", "latest");
    jobsUrl.searchParams.set("per_page", "100");
    const jobsResult = await requestJson(fetchImplementation, jobsUrl, {
      headers: requestHeaders({ Authorization: `Bearer ${configuration.token}` }),
    });
    const jobs = Array.isArray(jobsResult?.jobs) ? jobsResult.jobs : [];
    if (jobs.some((job) =>
      job?.name === UAT_JOB_NAME &&
      job?.status === "completed" &&
      job?.conclusion === "success"
    )) {
      return run;
    }
  }
  throw new Error(`No successful ${UAT_JOB_NAME} job evidence exists for ${revision}.`);
}

export function productionEnabled(source = process.env) {
  return source.PRODUCTION_DEPLOY_ENABLED === "true";
}

export async function prepareProductionPromotion(
  source = process.env,
  { fetchImplementation = fetch, runGit = defaultGit } = {},
) {
  validateRepository(source);
  const release = resolveRelease(source, runGit);
  const evidence = await verifyExactUatEvidence(release.releaseSha, source, fetchImplementation);
  return {
    ...release,
    productionEnabled: productionEnabled(source),
    uatRunId: String(evidence.id),
  };
}

export function productionConfiguration(source = process.env) {
  validateRepository(source);
  const composeId = required(source, "DOKPLOY_PRODUCTION_COMPOSE_ID");
  if (!composeIdPattern.test(composeId)) {
    throw new Error("DOKPLOY_PRODUCTION_COMPOSE_ID has an invalid format.");
  }
  return {
    cloudflareAccessClientId: required(source, "CF_ACCESS_CLIENT_ID"),
    cloudflareAccessClientSecret: required(source, "CF_ACCESS_CLIENT_SECRET"),
    composeId,
    dokployApiToken: required(source, "DOKPLOY_API_TOKEN"),
    dokployOrigin: validateHttpsOrigin(required(source, "DOKPLOY_URL"), "DOKPLOY_URL"),
    releaseSha: validateRevision(required(source, "RELEASE_SHA")),
    releaseVersion: validateStableVersion(required(source, "RELEASE_VERSION")),
  };
}

function dokployAuthentication(configuration) {
  return {
    "CF-Access-Client-Id": configuration.cloudflareAccessClientId,
    "CF-Access-Client-Secret": configuration.cloudflareAccessClientSecret,
    "x-api-key": configuration.dokployApiToken,
  };
}

function dokployUrl(origin, path) {
  return new URL(path, `${origin}/`).href;
}

function canonicalComposePath(path) {
  return typeof path === "string" ? path.trim().replace(/^\.\/+/, "") : path;
}

function deploymentRecords(compose) {
  if (!Array.isArray(compose.deployments)) {
    throw new Error("The Dokploy production resource did not report deployment records.");
  }
  for (const deployment of compose.deployments) {
    if (typeof deployment?.deploymentId !== "string" || !deployment.deploymentId) {
      throw new Error("The Dokploy production resource reported an invalid deployment record.");
    }
  }
  return compose.deployments;
}

export async function verifyProductionCompose(fetchImplementation, configuration) {
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
  if (compose.branch !== PRODUCTION_DEFAULT_REF && !stableVersionPattern.test(compose.branch ?? "")) {
    failures.push("branch=main-or-stable-SemVer-tag");
  }
  if (compose.autoDeploy !== false) {
    failures.push("autoDeploy=false");
  }
  if (compose.composeType !== "docker-compose") {
    failures.push("composeType=docker-compose");
  }
  if (canonicalComposePath(compose.composePath) !== PRODUCTION_COMPOSE_PATH) {
    failures.push(`composePath=${PRODUCTION_COMPOSE_PATH}`);
  }
  if (failures.length) {
    throw new Error(`The Dokploy production resource does not match the inactive contract: ${failures.join(", ")}.`);
  }
  if (compose.composeStatus === "running") {
    throw new Error("The Dokploy production resource already has a running deployment.");
  }
  if (!["done", "idle"].includes(compose.composeStatus)) {
    throw new Error("The Dokploy production resource is not idle or done before promotion.");
  }
  deploymentRecords(compose);
  return compose;
}

export function createOrVerifyTag(configuration, runGit = defaultGit) {
  const tagRef = `refs/tags/${configuration.releaseVersion}`;
  const peeledRef = `${tagRef}^{}`;
  const existing = runGit(["ls-remote", "origin", tagRef, peeledRef]);
  if (existing) {
    const refs = existing.split("\n").map((line) => line.trim().split(/\s+/));
    const existingSha = refs.find(([, ref]) => ref === peeledRef)?.[0]?.toLowerCase();
    if (!existingSha) {
      throw new Error(`${configuration.releaseVersion} exists but is not an annotated tag.`);
    }
    if (existingSha !== configuration.releaseSha) {
      throw new Error(`${configuration.releaseVersion} points to a different revision.`);
    }
    return;
  }
  runGit(["config", "user.name", "github-actions[bot]"]);
  runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  runGit([
    "tag",
    "--annotate",
    configuration.releaseVersion,
    configuration.releaseSha,
    "--message",
    `Release ${configuration.releaseVersion}`,
  ]);
  runGit(["push", "origin", `refs/tags/${configuration.releaseVersion}`]);
}

async function updateProductionRef(fetchImplementation, configuration) {
  const response = await requestJson(
    fetchImplementation,
    dokployUrl(configuration.dokployOrigin, "/api/compose.update"),
    {
      method: "POST",
      headers: requestHeaders(dokployAuthentication(configuration)),
      body: JSON.stringify({
        autoDeploy: false,
        branch: configuration.releaseVersion,
        composeId: configuration.composeId,
      }),
    },
  );
  if (response?.branch !== undefined && response.branch !== configuration.releaseVersion) {
    throw new Error("Dokploy did not accept the requested production release tag.");
  }
  const compose = await verifyProductionCompose(fetchImplementation, configuration);
  if (compose.branch !== configuration.releaseVersion) {
    throw new Error("Dokploy did not retain the production release tag.");
  }
}

function productionDeploymentDescription(configuration) {
  return `Automated production deployment for ${githubRepository}@${configuration.releaseSha} (${configuration.releaseVersion})`;
}

async function triggerProductionDeployment(fetchImplementation, configuration) {
  const description = productionDeploymentDescription(configuration);
  const response = await requestJson(
    fetchImplementation,
    dokployUrl(configuration.dokployOrigin, "/api/compose.deploy"),
    {
      method: "POST",
      headers: requestHeaders(dokployAuthentication(configuration)),
      body: JSON.stringify({
        composeId: configuration.composeId,
        description,
        freshVolumes: false,
        title: `Deploy ${configuration.releaseVersion}`,
      }),
    },
  );
  if (response?.success !== true || response.composeId !== configuration.composeId) {
    throw new Error("Dokploy did not confirm the requested production deployment.");
  }
}

export async function waitForProductionDeployment(
  configuration,
  previousDeploymentIds,
  {
    fetchImplementation = fetch,
    intervalMilliseconds = 5_000,
    sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
    timeoutMilliseconds = 15 * 60_000,
  } = {},
) {
  const deadline = Date.now() + timeoutMilliseconds;
  const requestedDescription = productionDeploymentDescription(configuration);
  const completedDescription = `Commit: ${configuration.releaseSha}`;
  let deploymentId;
  while (Date.now() < deadline) {
    const compose = await requestJson(
      fetchImplementation,
      dokployUrl(configuration.dokployOrigin, `/api/compose.one?composeId=${encodeURIComponent(configuration.composeId)}`),
      { headers: requestHeaders(dokployAuthentication(configuration)) },
    );
    const deployments = deploymentRecords(compose);
    if (deploymentId === undefined) {
      const correlatedDeployments = deployments.filter((deployment) =>
        !previousDeploymentIds.has(deployment.deploymentId) &&
        (deployment.description === requestedDescription || deployment.description === completedDescription)
      );
      if (correlatedDeployments.length > 1) {
        throw new Error("Dokploy reported multiple correlated production deployments.");
      }
      deploymentId = correlatedDeployments[0]?.deploymentId;
    }
    const deployment = deployments.find(({ deploymentId: candidate }) => candidate === deploymentId);
    switch (deployment?.status) {
      case "done":
        if (deployment.description === completedDescription) {
          return deploymentId;
        }
        if (/^Commit: [0-9a-f]{40}$/i.test(deployment.description ?? "")) {
          throw new Error("Dokploy deployed a different production source revision than requested.");
        }
        break;
      case "error":
      case "cancelled":
        throw new Error("Dokploy reported a failed production deployment.");
      case "running":
      case undefined:
        break;
      default:
        throw new Error("Dokploy reported an unexpected production deployment status.");
    }
    if (compose.composeStatus === "error") {
      throw new Error("Dokploy reported a failed production deployment.");
    }
    if (!["done", "idle", "running"].includes(compose.composeStatus)) {
      throw new Error("Dokploy reported an unexpected production deployment status.");
    }
    await sleep(intervalMilliseconds);
  }
  throw new Error(`Dokploy did not complete the production deployment within ${timeoutMilliseconds}ms.`);
}

export async function deployProduction(
  source = process.env,
  { fetchImplementation = fetch, runGit = defaultGit, waitOptions = {} } = {},
) {
  if (!productionEnabled(source)) {
    throw new Error("Production deployment is disabled. PRODUCTION_DEPLOY_ENABLED must equal true.");
  }
  const configuration = productionConfiguration(source);
  runGit(["fetch", "--force", "--tags", "origin", "main:refs/remotes/origin/main"]);
  const currentMain = validateRevision(runGit(["rev-parse", "origin/main"]));
  if (currentMain !== configuration.releaseSha) {
    throw new Error("main advanced after production promotion validation.");
  }

  const compose = await verifyProductionCompose(fetchImplementation, configuration);
  if (compose.branch === configuration.releaseVersion) {
    throw new Error(
      "The production resource is already pinned to this release. Reconcile the previous promotion manually before retrying.",
    );
  }
  const previousDeploymentIds = new Set(deploymentRecords(compose).map(({ deploymentId }) => deploymentId));
  createOrVerifyTag(configuration, runGit);
  await updateProductionRef(fetchImplementation, configuration);
  await triggerProductionDeployment(fetchImplementation, configuration);
  return waitForProductionDeployment(configuration, previousDeploymentIds, {
    ...waitOptions,
    fetchImplementation,
  });
}

function writeOutputs(outputs, outputPath) {
  const lines = Object.entries(outputs).map(([name, value]) => `${name}=${value}`).join("\n");
  if (outputPath) {
    appendFileSync(outputPath, `${lines}\n`, { encoding: "utf8" });
  } else {
    console.log(lines);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2];
  if (mode === "prepare") {
    const result = await prepareProductionPromotion();
    writeOutputs({
      production_enabled: result.productionEnabled,
      release_sha: result.releaseSha,
      release_version: result.releaseVersion,
      uat_run_id: result.uatRunId,
    }, process.env.GITHUB_OUTPUT);
  } else if (mode === "deploy") {
    const deploymentId = await deployProduction();
    console.log(`Production deployment ${deploymentId} completed.`);
  } else {
    throw new Error("Usage: node scripts/promote-production.mjs <prepare|deploy>");
  }
}
