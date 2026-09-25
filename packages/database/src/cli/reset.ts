import { spawn } from 'node:child_process';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';

import { assertSafeSeedOrResetTarget } from '../safety.js';

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);

console.log(
    `Reset authorized for the positively identified ${environment.appEnvironment} database.`,
);
const result = await new Promise<number>((resolve, reject) => {
    const child = spawn('prisma', ['migrate', 'reset', '--force', '--config', 'prisma.config.ts'], {
        env: process.env,
        stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
});

process.exitCode = result;
