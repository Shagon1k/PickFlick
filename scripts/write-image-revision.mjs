import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const revisionPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const symbolicHeadPattern = /^ref: (refs\/heads\/[A-Za-z0-9._/-]+)$/;

export function resolveImageRevision(configuredRevision, readFile = readFileSync) {
  let revision = configuredRevision?.trim();
  if (!revision) {
    const head = readFile(".git/HEAD", "utf8").trim();
    const symbolicHead = symbolicHeadPattern.exec(head);
    if (symbolicHead?.[1].split("/").includes("..")) {
      throw new Error("The image Git HEAD contains an unsafe symbolic reference.");
    }
    revision = symbolicHead ? readFile(resolve(".git", symbolicHead[1]), "utf8").trim() : head;
  }
  if (!revisionPattern.test(revision)) {
    throw new Error("The image source revision must be a full hexadecimal Git revision.");
  }
  return revision.toLowerCase();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  writeFileSync(".source-revision", resolveImageRevision(process.argv[2]), { encoding: "utf8" });
}
