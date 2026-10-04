import { readFile } from 'node:fs/promises';

const jsonFiles = [
    new URL('../tsconfig/base.json', import.meta.url),
    new URL('../tsconfig/library.json', import.meta.url),
    new URL('../tsconfig/nextjs.json', import.meta.url),
    new URL('../tsconfig/node.json', import.meta.url),
];

await Promise.all(jsonFiles.map(async (file) => JSON.parse(await readFile(file, 'utf8'))));
console.log(`Shared configuration valid (${jsonFiles.length} files).`);
