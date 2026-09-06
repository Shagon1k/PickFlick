import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expectedPackages = new Map([
  ["apps/api", "@pickflick/api"],
  ["apps/web", "@pickflick/web"],
  ["apps/worker", "@pickflick/worker"],
  ["packages/config", "@pickflick/config"],
  ["packages/contracts", "@pickflick/contracts"],
  ["packages/database", "@pickflick/database"],
  ["packages/observability", "@pickflick/observability"],
  ["packages/ui", "@pickflick/ui"],
]);

const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const ignoredTestSearchDirectories = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const testFilePattern = /\.(?:spec|test)\.[cm]?[jt]sx?$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function workspaceManifests(root) {
  const manifests = [];

  for (const parent of ["apps", "packages"]) {
    const entries = await readdir(join(root, parent), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const directory = join(parent, entry.name);
      manifests.push({ directory, manifest: await readJson(join(root, directory, "package.json")) });
    }
  }

  return manifests;
}

async function misplacedTestFiles(root) {
  const misplaced = [];

  const visit = async (directory, insideTestDirectory = false) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ignoredTestSearchDirectories.has(entry.name)) {
          continue;
        }
        await visit(path, insideTestDirectory || entry.name === "__tests__");
      } else if (testFilePattern.test(entry.name) && !insideTestDirectory) {
        misplaced.push(relative(root, path));
      }
    }
  };

  await Promise.all(["apps", "packages", "scripts"].map((directory) => visit(join(root, directory))));
  return misplaced.sort();
}

export async function checkWorkspace(root) {
  const manifests = await workspaceManifests(root);
  const errors = [];
  const byName = new Map(manifests.map((entry) => [entry.manifest.name, entry]));

  for (const path of await misplacedTestFiles(root)) {
    errors.push(`${path} must be placed under a __tests__ directory`);
  }

  for (const [directory, expectedName] of expectedPackages) {
    const entry = manifests.find((candidate) => candidate.directory === directory);
    if (!entry) {
      errors.push(`Missing workspace: ${directory}`);
    } else if (entry.manifest.name !== expectedName) {
      errors.push(`${directory} must be named ${expectedName}`);
    }
  }

  for (const { directory, manifest } of manifests) {
    if (!manifest.private) {
      errors.push(`${directory} must be private`);
    }

    for (const field of dependencyFields) {
      for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
        if (!dependency.startsWith("@pickflick/")) {
          continue;
        }
        if (!byName.has(dependency)) {
          errors.push(`${directory} references unknown workspace ${dependency}`);
        }
        if (!String(version).startsWith("workspace:")) {
          errors.push(`${directory} must use workspace: for ${dependency}`);
        }
        if (dependency !== manifest.name) {
          const target = byName.get(dependency);
          if (target?.directory.startsWith("apps/")) {
            errors.push(`${directory} must not depend on application workspace ${target.directory}`);
          }
        }
      }
    }
  }

  const graph = new Map();
  for (const { manifest } of manifests) {
    const dependencies = dependencyFields.flatMap((field) => Object.keys(manifest[field] ?? {}));
    graph.set(manifest.name, dependencies.filter((dependency) => byName.has(dependency)));
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (name, path) => {
    if (visiting.has(name)) {
      errors.push(`Workspace dependency cycle: ${[...path, name].join(" -> ")}`);
      return;
    }
    if (visited.has(name)) {
      return;
    }

    visiting.add(name);
    for (const dependency of graph.get(name) ?? []) {
      visit(dependency, [...path, name]);
    }
    visiting.delete(name);
    visited.add(name);
  };

  for (const name of graph.keys()) {
    visit(name, []);
  }

  return errors;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedFile === currentFile) {
  const root = resolve(dirname(currentFile), "..");
  const errors = await checkWorkspace(root);
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Workspace boundaries valid (${expectedPackages.size} workspaces).`);
  }
}
