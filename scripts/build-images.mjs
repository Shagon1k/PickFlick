import { spawnSync } from "node:child_process";

const targets = ["web", "api", "worker", "release"];

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { encoding: "utf8", stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? 1}.`);
  }
}

function sourceRevision() {
  const configured = process.env.SOURCE_REVISION?.trim();
  if (configured) {
    return configured;
  }
  const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  if (status.status !== 0) {
    throw new Error("SOURCE_REVISION is required when Git worktree state cannot be inspected.");
  }
  if (status.stdout.trim()) {
    throw new Error("Refusing to label an image from a dirty worktree. Commit the exact source or set SOURCE_REVISION explicitly.");
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("SOURCE_REVISION is required when the Git revision cannot be resolved.");
  }
  return result.stdout.trim();
}

const revision = sourceRevision();
if (!/^[0-9a-f]{40,64}$/i.test(revision)) {
  throw new Error("SOURCE_REVISION must be a full hexadecimal source revision.");
}

for (const target of targets) {
  const tag = `pickflick-${target}:${revision.slice(0, 12)}`;
  run("docker", [
    "build",
    "--build-arg",
    `SOURCE_REVISION=${revision}`,
    "--provenance=false",
    "--target",
    target,
    "--tag",
    tag,
    ".",
  ]);
  console.log(`Built ${target} image: ${tag}.`);
}
