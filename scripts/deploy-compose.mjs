import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const composeArguments = ["compose", "-f", "compose.deploy.yaml"];

function runDocker(arguments_, environment) {
  const result = spawnSync("docker", arguments_, { env: environment, stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`docker failed with exit code ${result.status ?? 1}.`);
  }
}

export function deployCompose(run = runDocker, source = process.env) {
  if (source.APP_ENV !== "uat") {
    throw new Error("Source-built Compose deployment may only run for APP_ENV=uat.");
  }

  run([...composeArguments, "up", "--build", "-d", "--wait", "--remove-orphans"], source);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  deployCompose();
}
