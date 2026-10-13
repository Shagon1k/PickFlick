import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { loadDatabaseEnvironment } from '../packages/config/dist/environment.js';
import {
    assertSafeSeedOrResetTarget,
    createDatabaseClient,
    snapshotSessionSettings,
} from '../packages/database/dist/index.js';

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const prisma = createDatabaseClient(environment.databaseUrl);
const clubId = randomUUID();
const sessionId = randomUUID();
let child;

async function stop() {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
    child.kill('SIGTERM');
    const result = await Promise.race([exited, setTimeout(10000, 'timeout', { ref: false })]);
    if (result === 'timeout') {
        child.kill('SIGKILL');
        throw new Error('Worker did not shut down within 10 seconds.');
    }
    if (result !== 0) throw new Error('Worker shutdown failed.');
}

async function run() {
    let scanned = false;
    child = spawn(process.execPath, ['apps/backend/dist/deadline-worker.js'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('deadline.scan')) scanned = true;
    });
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error('Worker exited before scan.');
        const decision = await prisma.nominationDeadlineDecision.findUnique({
            where: { sessionId_deadlineVersion: { sessionId, deadlineVersion: 1 } },
        });
        if (scanned && decision?.outcome === 'EMPTY') return;
        await setTimeout(100);
    }
    throw new Error('Worker did not execute the overdue deadline.');
}

try {
    await prisma.club.create({ data: { id: clubId, name: 'Worker smoke fixture' } });
    await prisma.session.create({
        data: {
            id: sessionId,
            clubId,
            type: 'FULL_CYCLE',
            phase: 'NOMINATION',
            deadlineAt: new Date(Date.now() - 60000),
            ...(await snapshotSessionSettings(prisma, clubId)),
        },
    });
    await run();
    await stop();
    await run();
    await stop();
    const count = await prisma.nominationDeadlineDecision.count({ where: { sessionId } });
    if (count !== 1) throw new Error('Restart repeated the empty deadline decision.');
    console.log(
        'Deadline worker smoke passed: Session deadline scan, durable empty decision, restart, SIGTERM shutdown.',
    );
} finally {
    await stop();
    await prisma.nominationDeadlineDecision.deleteMany({ where: { sessionId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.club.deleteMany({ where: { id: clubId } });
    await prisma.$disconnect();
}
