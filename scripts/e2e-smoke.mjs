import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const timeoutMilliseconds = Number(process.env.E2E_SMOKE_TIMEOUT_MS ?? 30_000);

async function availablePort(configuredPort, excludedPorts = []) {
    if (configuredPort) {
        const port = Number(configuredPort);
        if (excludedPorts.includes(port)) {
            throw new Error('E2E_WEB_PORT and E2E_API_PORT must be different.');
        }
        return port;
    }
    while (true) {
        const server = createServer();
        await new Promise((resolveListen, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolveListen);
        });
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Could not allocate a loopback port for the E2E smoke check.');
        }
        await new Promise((resolveClose, reject) =>
            server.close((error) => (error ? reject(error) : resolveClose())),
        );
        if (!excludedPorts.includes(address.port)) {
            return address.port;
        }
    }
}

const webPort = await availablePort(process.env.E2E_WEB_PORT);
const apiPort = await availablePort(process.env.E2E_API_PORT, [webPort]);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const runtimeEnvironment = {
    ...process.env,
    API_HOST: '127.0.0.1',
    API_PORT: String(apiPort),
    AUTH_BASE_URL: apiOrigin,
};

function startRuntime(name, arguments_, onOutput = () => undefined) {
    const child = spawn('pnpm', arguments_, {
        cwd: repositoryRoot,
        detached: process.platform !== 'win32',
        env: runtimeEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let exited;
    const exit = new Promise((resolveExit) => {
        child.once('error', (error) => resolveExit({ error }));
        child.once('exit', (code, signal) => resolveExit({ code, signal }));
    }).then((result) => {
        exited = result;
        return result;
    });
    for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding('utf8');
        stream.on('data', onOutput);
    }
    return {
        name,
        child,
        exit,
        get exited() {
            return exited;
        },
    };
}

async function waitFor(label, check, runtimes) {
    const deadline = Date.now() + timeoutMilliseconds;
    let lastError;
    while (Date.now() < deadline) {
        const stopped = runtimes.find(({ exited }) => exited);
        if (stopped) {
            throw new Error(`${stopped.name} stopped before the smoke check completed.`);
        }
        try {
            if (await check()) {
                return;
            }
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    throw new Error(`${label} did not become ready within ${timeoutMilliseconds}ms.`, {
        cause: lastError,
    });
}

async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) {
        return undefined;
    }
    return response.json();
}

async function stopRuntime(runtime) {
    if (runtime.child.pid === undefined) {
        return;
    }
    const target = process.platform === 'win32' ? runtime.child.pid : -runtime.child.pid;
    try {
        process.kill(target, 'SIGTERM');
    } catch (error) {
        if (error?.code !== 'ESRCH') {
            throw error;
        }
    }
    if (runtime.exited) {
        return;
    }
    const stopped = await Promise.race([
        runtime.exit.then(() => true),
        new Promise((resolveWait) => setTimeout(() => resolveWait(false), 10_000)),
    ]);
    if (!stopped) {
        process.kill(target, 'SIGKILL');
        await runtime.exit;
    }
}

const runtimes = [
    startRuntime('web', [
        '--filter',
        '@pickflick/web',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(webPort),
    ]),
    startRuntime('api', ['--filter', '@pickflick/api', 'start']),
];

try {
    await Promise.all([
        waitFor(
            'web',
            async () => {
                const response = await fetch(`http://127.0.0.1:${webPort}/`, {
                    signal: AbortSignal.timeout(2_000),
                });
                return response.ok && (await response.text()).includes('PickFlick');
            },
            runtimes,
        ),
        waitFor(
            'API liveness',
            async () =>
                (await fetchJson(`http://127.0.0.1:${apiPort}/health/live`))?.status === 'alive',
            runtimes,
        ),
        waitFor(
            'API readiness',
            async () => {
                const report = await fetchJson(`http://127.0.0.1:${apiPort}/health/ready`);
                return (
                    report?.status === 'ready' &&
                    report.checks.every(({ status }) => status === 'up')
                );
            },
            runtimes,
        ),
    ]);
    const appleAuthResponse = await fetch(`${apiOrigin}/api/auth/sign-in/social`, {
        body: JSON.stringify({ callbackURL: '/app', provider: 'apple' }),
        headers: { 'content-type': 'application/json', origin: apiOrigin },
        method: 'POST',
        signal: AbortSignal.timeout(2_000),
    });
    const appleAuth = await appleAuthResponse.json();
    if (
        !appleAuthResponse.ok ||
        typeof appleAuth.url !== 'string' ||
        new URL(appleAuth.url).hostname !== 'appleid.apple.com'
    ) {
        throw new Error('The built API did not start the reviewed Apple authorization flow.');
    }

    const unsupportedAuthResponse = await fetch(`${apiOrigin}/api/auth/sign-in/social`, {
        body: JSON.stringify({ callbackURL: '/app', provider: 'github' }),
        headers: { 'content-type': 'application/json', origin: apiOrigin },
        method: 'POST',
        signal: AbortSignal.timeout(2_000),
    });
    const unsupportedAuthFailure = await unsupportedAuthResponse.json();
    if (
        unsupportedAuthResponse.status !== 400 ||
        unsupportedAuthFailure.code !== 'UNSUPPORTED_IDENTITY_PROVIDER'
    ) {
        throw new Error(
            'The built API authentication handler is not mounted at the reviewed raw-request boundary.',
        );
    }
    console.log(
        'E2E smoke passed: built web, API, and Apple authentication boundary are ready against isolated dependencies.',
    );
} finally {
    await Promise.all(runtimes.map(stopRuntime));
}
