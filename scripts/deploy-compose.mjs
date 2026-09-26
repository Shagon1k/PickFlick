import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { sourceRevision } from './build-images.mjs';

const composeArguments = ['compose', '-f', 'compose.deploy.yaml'];

function runDocker(arguments_, environment) {
    const result = spawnSync('docker', arguments_, { env: environment, stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`docker failed with exit code ${result.status ?? 1}.`);
    }
}

/**
 * @param {(arguments_: string[], environment: NodeJS.ProcessEnv) => unknown} [run]
 * @param {NodeJS.ProcessEnv} [source]
 * @param {(source: NodeJS.ProcessEnv) => string} [resolveRevision]
 */
export function deployCompose(
    run = runDocker,
    source = process.env,
    resolveRevision = sourceRevision,
) {
    if (source.APP_ENV !== 'uat') {
        throw new Error('Source-built Compose deployment may only run for APP_ENV=uat.');
    }

    const environment = { ...source, SOURCE_REVISION: resolveRevision(source) };
    run([...composeArguments, 'up', '--build', '-d', '--wait', '--remove-orphans'], environment);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    deployCompose();
}
