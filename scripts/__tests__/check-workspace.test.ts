import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { checkWorkspace } from '../check-workspace.mjs';

async function writeManifest(root: string, directory: string, manifest: object) {
    const path = join(root, directory);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify(manifest));
}

async function createWorkspace() {
    const root = await mkdtemp(join(tmpdir(), 'pickflick-workspace-'));
    const entries = [
        ['apps/api', '@pickflick/api'],
        ['apps/web', '@pickflick/web'],
        ['apps/worker', '@pickflick/worker'],
        ['packages/config', '@pickflick/config'],
        ['packages/contracts', '@pickflick/contracts'],
        ['packages/database', '@pickflick/database'],
        ['packages/observability', '@pickflick/observability'],
        ['packages/ui', '@pickflick/ui'],
    ] as const;

    await Promise.all(
        entries.map(([directory, name]) => writeManifest(root, directory, { name, private: true })),
    );
    return root;
}

describe('checkWorkspace', () => {
    it('accepts the approved topology', async () => {
        const root = await createWorkspace();

        await expect(checkWorkspace(root)).resolves.toEqual([]);
    });

    it('rejects application dependencies and workspace cycles', async () => {
        const root = await createWorkspace();
        await writeManifest(root, 'apps/api', {
            name: '@pickflick/api',
            private: true,
            dependencies: { '@pickflick/web': 'workspace:*' },
        });
        await writeManifest(root, 'apps/web', {
            name: '@pickflick/web',
            private: true,
            dependencies: { '@pickflick/api': 'workspace:*' },
        });

        const errors = await checkWorkspace(root);

        expect(errors).toContain('apps/api must not depend on application workspace apps/web');
        expect(errors).toContain('apps/web must not depend on application workspace apps/api');
        expect(errors.some((error) => error.startsWith('Workspace dependency cycle:'))).toBe(true);
    });

    it('rejects package dependencies on application workspaces', async () => {
        const root = await createWorkspace();
        await writeManifest(root, 'packages/database', {
            name: '@pickflick/database',
            private: true,
            dependencies: { '@pickflick/api': 'workspace:*' },
        });

        const errors = await checkWorkspace(root);

        expect(errors).toContain(
            'packages/database must not depend on application workspace apps/api',
        );
    });

    it('rejects test files outside __tests__ directories', async () => {
        const root = await createWorkspace();
        const sourceDirectory = join(root, 'apps/api/src');
        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(join(sourceDirectory, 'app.test.ts'), '');

        const errors = await checkWorkspace(root);

        expect(errors).toContain(
            'apps/api/src/app.test.ts must be placed under a __tests__ directory',
        );
    });
});
