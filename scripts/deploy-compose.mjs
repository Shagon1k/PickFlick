import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const composeArguments = ["compose", "-f", "compose.deploy.yaml"];

function runDocker(arguments_) {
  const result = spawnSync("docker", arguments_, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`docker failed with exit code ${result.status ?? 1}.`);
  }
}

export function deployCompose(run = runDocker) {
  run([...composeArguments, "--profile", "release", "run", "--build", "--rm", "release"]);
  run([...composeArguments, "--profile", "application", "up", "--build", "-d", "--wait"]);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  deployCompose();
}
