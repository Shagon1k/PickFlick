import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { test } from "@playwright/test";

const executeFile = promisify(execFile);

test("passes the component accessibility and interaction smoke", async ({ baseURL }, testInfo) => {
  const result = await executeFile(
    process.execPath,
    ["scripts/ui-preview-smoke.mjs", baseURL ?? "http://127.0.0.1:41730"],
    { cwd: process.cwd(), timeout: 55_000 },
  );
  await testInfo.attach("interaction-smoke.txt", {
    body: Buffer.from(`${result.stdout}${result.stderr}`),
    contentType: "text/plain",
  });
});
