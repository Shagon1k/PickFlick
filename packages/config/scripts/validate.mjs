import { readFile } from "node:fs/promises";

const eslintFile = new URL("../eslint/base.mjs", import.meta.url);
const jsonFiles = [
  new URL("../tsconfig/base.json", import.meta.url),
  new URL("../tsconfig/library.json", import.meta.url),
  new URL("../tsconfig/nextjs.json", import.meta.url),
  new URL("../tsconfig/node.json", import.meta.url),
];

await Promise.all(jsonFiles.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
const { default: eslintConfig } = await import(eslintFile.href);
if (!Array.isArray(eslintConfig)) throw new TypeError("ESLint configuration must export an array.");

console.log(`Shared configuration valid (${jsonFiles.length + 1} files).`);
