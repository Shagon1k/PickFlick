import { spawn } from 'node:child_process';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';

const allowedArguments = new Set(['migrate deploy', 'db seed']);
const argumentsToPrisma = process.argv.slice(2);
if (!allowedArguments.has(argumentsToPrisma.join(' '))) {
    throw new Error('Unsupported Prisma command wrapper invocation.');
}

loadDatabaseEnvironment();

const result = await new Promise<number>((resolve, reject) => {
    const child = spawn('prisma', [...argumentsToPrisma, '--config', 'prisma.config.ts'], {
        env: process.env,
        stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
});

process.exitCode = result;
