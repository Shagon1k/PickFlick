import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = ['frontend', 'backend', 'release'];

function run(command, arguments_) {
    const result = spawnSync(command, arguments_, { encoding: 'utf8', stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} failed with exit code ${result.status ?? 1}.`);
    }
}

function validateRevision(revision) {
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(revision)) {
        throw new Error('SOURCE_REVISION must be a full hexadecimal source revision.');
    }
    return revision;
}

/**
 * @param {Record<string, string | undefined>} [source]
 * @param {(arguments_: string[]) => { status: number | null; stdout: string }} [runGit]
 * @returns {string}
 */
export function sourceRevision(
    source = process.env,
    runGit = (arguments_) => spawnSync('git', arguments_, { encoding: 'utf8' }),
) {
    const configured = source.SOURCE_REVISION?.trim();
    if (configured) {
        validateRevision(configured);
    }

    const worktree = runGit(['rev-parse', '--is-inside-work-tree']);
    if (worktree.status !== 0 || worktree.stdout.trim() !== 'true') {
        if (configured) {
            return configured;
        }
        throw new Error('SOURCE_REVISION is required when Git worktree state cannot be inspected.');
    }

    const status = runGit(['status', '--porcelain']);
    if (status.status !== 0) {
        throw new Error('Git worktree state could not be inspected.');
    }
    if (status.stdout.trim()) {
        throw new Error(
            'Refusing to label an image from a dirty worktree. Commit the exact source first.',
        );
    }

    const result = runGit(['rev-parse', 'HEAD']);
    if (result.status !== 0) {
        throw new Error('The Git source revision could not be resolved.');
    }
    const headRevision = validateRevision(result.stdout.trim());
    if (configured && configured.toLowerCase() !== headRevision.toLowerCase()) {
        throw new Error('SOURCE_REVISION must match the checked-out Git HEAD.');
    }
    return configured ?? headRevision;
}

export function buildImages() {
    const revision = sourceRevision();

    for (const target of targets) {
        const tag = `pickflick-${target}:${revision.slice(0, 12)}`;
        run('docker', [
            'build',
            '--build-arg',
            `SOURCE_REVISION=${revision}`,
            '--provenance=false',
            '--target',
            target,
            '--tag',
            tag,
            '.',
        ]);
        console.log(`Built ${target} image: ${tag}.`);
    }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    buildImages();
}
