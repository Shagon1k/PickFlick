import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { evaluateAudit, verifyBracesPatch } from './security/audit-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const policy = JSON.parse(
    await readFile(new URL('./security/braces-exception.json', import.meta.url), 'utf8'),
);
const run = (args) =>
    spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// Never suppress raw findings or turn a registry/process error into a green gate.
const audit = run(['audit', '--audit-level', 'high', '--json']);
process.stdout.write(audit.stdout ?? '');
process.stderr.write(audit.stderr ?? '');
try {
    if (audit.error || audit.signal) {
        throw audit.error ?? new Error(`Audit terminated by ${audit.signal}`);
    }
    const graph = run(['list', 'braces', '--depth', 'Infinity', '--json', '-r']);
    if (graph.error || graph.status !== 0) {
        throw graph.error ?? new Error(`Dependency graph failed: ${graph.stderr}`);
    }
    const copies = await verifyBracesPatch(root, policy, JSON.parse(graph.stdout));
    const allowed = evaluateAudit(audit.stdout, audit.status, policy);
    console.log(`Verified patched braces@3.0.3 (${copies} installed copies).`);
    console.log(
        `Temporary exception: ${policy.advisory}; findings=${allowed}; expires=${policy.expires}.`,
    );
    console.log(`Residual risk: ${policy.reason}`);
} catch (error) {
    console.error('Security audit rejected:', error);
    process.exitCode = audit.status && audit.status !== 1 ? audit.status : 1;
}
