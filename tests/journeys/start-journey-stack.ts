import { spawn } from 'node:child_process';

/** Starts the built API, waits until it is live, then starts the built web app in front of it. */
const backendPort = '42741';
const webPort = '41740';
const webOrigin = `http://127.0.0.1:${webPort}`;

const backend = spawn(process.execPath, ['apps/backend/dist/main.js'], {
    env: {
        ...process.env,
        AUTH_BASE_URL: webOrigin,
        BACKEND_HOST: '127.0.0.1',
        BACKEND_PORT: backendPort,
    },
    stdio: 'inherit',
});

const deadline = Date.now() + 60_000;
while (!(await isLive())) {
    if (Date.now() > deadline || backend.exitCode !== null) {
        backend.kill('SIGTERM');
        throw new Error('The journey API did not become live.');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
}

const web = spawn(process.execPath, ['apps/frontend/.next/standalone/apps/frontend/server.js'], {
    env: {
        ...process.env,
        BACKEND_INTERNAL_URL: `http://127.0.0.1:${backendPort}`,
        HOSTNAME: '127.0.0.1',
        PORT: webPort,
    },
    stdio: 'inherit',
});

const stop = () => {
    web.kill('SIGTERM');
    backend.kill('SIGTERM');
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
for (const child of [backend, web]) {
    child.once('exit', (code) => {
        stop();
        process.exitCode = code ?? 1;
    });
}

async function isLive(): Promise<boolean> {
    try {
        const response = await fetch(`http://127.0.0.1:${backendPort}/health/live`);
        return response.ok;
    } catch {
        return false;
    }
}
