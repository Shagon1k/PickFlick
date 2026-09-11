import { spawn } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = resolve(repositoryRoot, "packages/database");

export const releaseSteps = [
  {
    name: "migrations",
    command: process.execPath,
    arguments: ["dist/run-prisma.js", "migrate", "deploy"],
  },
  {
    name: "required seed",
    command: process.execPath,
    arguments: ["dist/seed-release.js"],
  },
];

export async function runCommand(step) {
  console.log(`Release step started: ${step.name}.`);
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(step.command, step.arguments, {
      cwd: databaseRoot,
      env: {
        ...process.env,
        PATH: `${resolve(databaseRoot, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`,
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`Release step failed: ${step.name}.`);
  }
  console.log(`Release step completed: ${step.name}.`);
}

export async function runReleaseSteps(runner = runCommand) {
  if (process.env.PICKFLICK_UAT_RELEASE_FAILURE_DRILL === "1") {
    throw new Error("Intentional UAT release-failure drill.");
  }

  for (const step of releaseSteps) {
    await runner(step);
  }
}

export function assertReleaseEnvironment(environment = process.env.APP_ENV) {
  if (environment !== "uat" && environment !== "production") {
    throw new Error("Release gate may only run for APP_ENV=uat or APP_ENV=production.");
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assertReleaseEnvironment();
    await runReleaseSteps();
    console.log("Release gate completed successfully.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release gate failed.");
    process.exitCode = 1;
  }
}
