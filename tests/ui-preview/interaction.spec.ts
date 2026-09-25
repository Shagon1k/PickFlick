import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { test } from '@playwright/test';

const executeFile = promisify(execFile);

test.setTimeout(75_000);

test('passes the component accessibility and interaction smoke', async ({ baseURL }, testInfo) => {
    let smokeOutput = '';

    try {
        const result = await executeFile(
            process.execPath,
            ['scripts/ui-preview-smoke.mjs', baseURL ?? 'http://127.0.0.1:41730'],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    UI_SMOKE_ARTIFACT_DIR: testInfo.outputPath('interaction-smoke'),
                },
            },
        );
        smokeOutput = `${result.stdout}${result.stderr}`;
    } catch (error) {
        const failure = error as { stderr?: string | Buffer; stdout?: string | Buffer };
        smokeOutput = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
        throw error;
    } finally {
        await testInfo.attach('interaction-smoke.txt', {
            body: Buffer.from(smokeOutput),
            contentType: 'text/plain',
        });
    }
});
