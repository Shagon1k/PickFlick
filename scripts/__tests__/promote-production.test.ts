import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
    PRODUCTION_COMPOSE_PATH,
    UAT_JOB_NAME,
    UAT_WORKFLOW_PATH,
    createOrVerifyTag,
    deployProduction,
    nextStableVersion,
    prepareProductionPromotion,
    verifyExactUatEvidence,
} from '../promote-production.mjs';

type FetchInput = Parameters<typeof fetch>[0];

const releaseSha = 'a'.repeat(40);
const source = {
    CF_ACCESS_CLIENT_ID: 'cloudflare-client',
    CF_ACCESS_CLIENT_SECRET: 'cloudflare-secret',
    DOKPLOY_API_TOKEN: 'dokploy-token',
    DOKPLOY_PRODUCTION_COMPOSE_ID: 'compose_prod_123',
    DOKPLOY_URL: 'https://dokploy.example.invalid',
    GITHUB_API_URL: 'https://api.github.example.invalid',
    GITHUB_REPOSITORY: 'Shagon1k/PickFlick',
    GITHUB_TOKEN: 'github-token',
    PRODUCTION_DEPLOY_ENABLED: 'true',
    RELEASE_SHA: releaseSha,
    RELEASE_TYPE: 'patch',
    RELEASE_VERSION: 'v0.0.1',
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status,
    });
}

function uatEvidence(overrides = {}) {
    return {
        conclusion: 'success',
        head_branch: 'main',
        head_repository: { full_name: 'Shagon1k/PickFlick' },
        head_sha: releaseSha,
        id: 12345,
        path: UAT_WORKFLOW_PATH,
        status: 'completed',
        updated_at: '2026-09-11T18:11:02Z',
        ...overrides,
    };
}

function uatJob(overrides = {}) {
    return {
        conclusion: 'success',
        name: UAT_JOB_NAME,
        status: 'completed',
        ...overrides,
    };
}

function exactUatFetch(runOverrides = {}, jobOverrides = {}) {
    return vi.fn(async (input: FetchInput) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/actions/workflows/deploy-uat.yml/runs')) {
            return jsonResponse({ workflow_runs: [uatEvidence(runOverrides)] });
        }
        if (url.pathname.endsWith('/actions/runs/12345/jobs')) {
            return jsonResponse({ jobs: [uatJob(jobOverrides)] });
        }
        throw new Error(`Unexpected request: ${url.href}`);
    });
}

function productionCompose(overrides = {}) {
    return {
        autoDeploy: false,
        branch: 'main',
        composePath: PRODUCTION_COMPOSE_PATH,
        composeStatus: 'done',
        composeType: 'docker-compose',
        deployments: [{ deploymentId: 'deployment-old', status: 'done' }],
        owner: 'Shagon1k',
        repository: 'PickFlick',
        sourceType: 'github',
        ...overrides,
    };
}

describe('production SemVer', () => {
    it('uses v0.0.0 as the baseline when no stable release tag exists', () => {
        expect(nextStableVersion([], 'patch')).toBe('v0.0.1');
        expect(nextStableVersion([], 'minor')).toBe('v0.1.0');
        expect(nextStableVersion([], 'major')).toBe('v1.0.0');
    });

    it('increments the highest stable tag and ignores non-stable tags', () => {
        const tags = ['v1.9.9', 'v2.0.0-rc.1', 'v1.10.0', 'not-a-version'];

        expect(nextStableVersion(tags, 'patch')).toBe('v1.10.1');
        expect(nextStableVersion(tags, 'minor')).toBe('v1.11.0');
        expect(nextStableVersion(tags, 'major')).toBe('v2.0.0');
    });

    it('rejects an unsupported release type', () => {
        expect(() => nextStableVersion([], 'prerelease')).toThrow(/patch, minor, or major/);
    });

    it('reuses an existing annotated tag only when it points to the release revision', () => {
        const runGit = vi.fn(() =>
            ['b'.repeat(40) + '\trefs/tags/v0.0.1', `${releaseSha}\trefs/tags/v0.0.1^{}`].join(
                '\n',
            ),
        );

        expect(() =>
            createOrVerifyTag({ releaseSha, releaseVersion: 'v0.0.1' }, runGit),
        ).not.toThrow();
        expect(runGit).toHaveBeenCalledTimes(1);
    });

    it('refuses an existing tag that resolves to another revision', () => {
        const runGit = vi.fn(() =>
            ['c'.repeat(40) + '\trefs/tags/v0.0.1', `${'b'.repeat(40)}\trefs/tags/v0.0.1^{}`].join(
                '\n',
            ),
        );

        expect(() => createOrVerifyTag({ releaseSha, releaseVersion: 'v0.0.1' }, runGit)).toThrow(
            /points to a different revision/,
        );
    });

    it('refuses a lightweight tag even when it points to the release revision', () => {
        const runGit = vi.fn(() => `${releaseSha}\trefs/tags/v0.0.1`);

        expect(() => createOrVerifyTag({ releaseSha, releaseVersion: 'v0.0.1' }, runGit)).toThrow(
            /is not an annotated tag/,
        );
    });
});

describe('exact UAT evidence', () => {
    it('accepts only a successful UAT workflow run for the exact main revision', async () => {
        const fetchImplementation = exactUatFetch();

        await expect(
            verifyExactUatEvidence(releaseSha, source, fetchImplementation),
        ).resolves.toMatchObject({ id: 12345 });
        const [runsRequest] = fetchImplementation.mock.calls[0];
        const runsUrl = new URL(String(runsRequest));
        expect(runsUrl.pathname).toContain('/actions/workflows/deploy-uat.yml/runs');
        expect(runsUrl.searchParams.get('head_sha')).toBe(releaseSha);
        const [jobsRequest] = fetchImplementation.mock.calls[1];
        const jobsUrl = new URL(String(jobsRequest));
        expect(jobsUrl.pathname).toContain('/actions/runs/12345/jobs');
        expect(jobsUrl.searchParams.get('filter')).toBe('latest');
    });

    it.each([
        ['skipped', { conclusion: 'skipped', status: 'completed' }],
        ['failed', { conclusion: 'failure', status: 'completed' }],
        ['incomplete', { conclusion: null, status: 'in_progress' }],
        ['wrong job', { name: 'Another job' }],
    ])('rejects a %s UAT E2E job', async (_name, overrides) => {
        const fetchImplementation = exactUatFetch({}, overrides);

        await expect(
            verifyExactUatEvidence(releaseSha, source, fetchImplementation),
        ).rejects.toThrow(/No successful UAT E2E job evidence/);
    });

    it('uses an older exact run when its UAT E2E job is the latest successful evidence', async () => {
        const fetchImplementation = vi.fn(async (input: FetchInput) => {
            const url = new URL(String(input));
            if (url.pathname.endsWith('/actions/workflows/deploy-uat.yml/runs')) {
                return jsonResponse({
                    workflow_runs: [
                        uatEvidence({ id: 23456, updated_at: '2026-09-11T19:11:02Z' }),
                        uatEvidence(),
                    ],
                });
            }
            if (url.pathname.endsWith('/actions/runs/23456/jobs')) {
                return jsonResponse({ jobs: [uatJob({ conclusion: 'skipped' })] });
            }
            if (url.pathname.endsWith('/actions/runs/12345/jobs')) {
                return jsonResponse({ jobs: [uatJob()] });
            }
            throw new Error(`Unexpected request: ${url.href}`);
        });

        await expect(
            verifyExactUatEvidence(releaseSha, source, fetchImplementation),
        ).resolves.toMatchObject({ id: 12345 });
    });

    it.each([
        ['failed', { conclusion: 'failure' }],
        ['wrong revision', { head_sha: 'b'.repeat(40) }],
        ['wrong workflow', { path: '.github/workflows/ci.yml' }],
        ['wrong repository', { head_repository: { full_name: 'example/fork' } }],
    ])('rejects %s evidence', async (_name, overrides) => {
        const fetchImplementation = vi.fn(async () =>
            jsonResponse({ workflow_runs: [uatEvidence(overrides)] }),
        );

        await expect(
            verifyExactUatEvidence(releaseSha, source, fetchImplementation),
        ).rejects.toThrow(/No successful exact UAT workflow evidence/);
    });

    it('rejects a missing successful workflow run', async () => {
        const fetchImplementation = vi.fn(async () => jsonResponse({ workflow_runs: [] }));

        await expect(
            verifyExactUatEvidence(releaseSha, source, fetchImplementation),
        ).rejects.toThrow(/No successful exact UAT workflow evidence/);
    });
});

describe('promotion preparation', () => {
    it('validates the current main revision while leaving production disabled', async () => {
        const git = vi.fn((arguments_: string[]) => {
            switch (arguments_.join(' ')) {
                case 'fetch --force --tags origin main:refs/remotes/origin/main':
                    return '';
                case 'rev-parse origin/main':
                    return releaseSha;
                case 'tag --list v[0-9]*':
                    return '';
                default:
                    throw new Error(`Unexpected Git arguments: ${arguments_.join(' ')}`);
            }
        });
        const fetchImplementation = exactUatFetch();

        await expect(
            prepareProductionPromotion(
                { ...source, PRODUCTION_DEPLOY_ENABLED: 'false' },
                { fetchImplementation, runGit: git },
            ),
        ).resolves.toEqual({
            productionEnabled: false,
            releaseSha,
            releaseVersion: 'v0.0.1',
            uatRunId: '12345',
        });
    });

    it('reuses the latest stable tag when it already points to current main', async () => {
        const git = vi.fn((arguments_: string[]) => {
            switch (arguments_.join(' ')) {
                case 'fetch --force --tags origin main:refs/remotes/origin/main':
                    return '';
                case 'rev-parse origin/main':
                    return releaseSha;
                case 'tag --list v[0-9]*':
                    return 'v0.0.1';
                case 'rev-list -n 1 v0.0.1':
                    return releaseSha;
                default:
                    throw new Error(`Unexpected Git arguments: ${arguments_.join(' ')}`);
            }
        });
        const fetchImplementation = exactUatFetch();

        await expect(
            prepareProductionPromotion(source, { fetchImplementation, runGit: git }),
        ).resolves.toMatchObject({ releaseVersion: 'v0.0.1' });
    });

    it('increments the latest stable tag when current main is newer', async () => {
        const git = vi.fn((arguments_: string[]) => {
            switch (arguments_.join(' ')) {
                case 'fetch --force --tags origin main:refs/remotes/origin/main':
                    return '';
                case 'rev-parse origin/main':
                    return releaseSha;
                case 'tag --list v[0-9]*':
                    return 'v0.0.1';
                case 'rev-list -n 1 v0.0.1':
                    return 'b'.repeat(40);
                default:
                    throw new Error(`Unexpected Git arguments: ${arguments_.join(' ')}`);
            }
        });
        const fetchImplementation = exactUatFetch();

        await expect(
            prepareProductionPromotion(source, { fetchImplementation, runGit: git }),
        ).resolves.toMatchObject({ releaseSha, releaseVersion: 'v0.0.2' });
    });
});

describe('production deployment guard', () => {
    it.each([undefined, '', 'false', 'TRUE', '1', ' true', 'true ', 'true\n', '\ttrue'])(
        'does not read Git or call a remote API when the guard is %s',
        async (guard) => {
            const fetchImplementation = vi.fn();
            const runGit = vi.fn();

            await expect(
                deployProduction(
                    { ...source, PRODUCTION_DEPLOY_ENABLED: guard },
                    { fetchImplementation, runGit },
                ),
            ).rejects.toThrow(/Production deployment is disabled/);
            expect(fetchImplementation).not.toHaveBeenCalled();
            expect(runGit).not.toHaveBeenCalled();
        },
    );

    it('rejects a mismatched production resource before creating a tag', async () => {
        const gitCalls: string[] = [];
        const runGit = vi.fn((arguments_: string[]) => {
            gitCalls.push(arguments_.join(' '));
            if (arguments_[0] === 'rev-parse') {
                return releaseSha;
            }
            return '';
        });
        const fetchImplementation = vi.fn(async () =>
            jsonResponse(productionCompose({ autoDeploy: true })),
        );

        await expect(deployProduction(source, { fetchImplementation, runGit })).rejects.toThrow(
            /autoDeploy=false/,
        );
        expect(gitCalls).not.toContain(
            `tag --annotate v0.0.1 ${releaseSha} --message Release v0.0.1`,
        );
        expect(gitCalls).not.toContain('push origin refs/tags/v0.0.1');
    });

    it('pins a verified tag with auto deploy disabled, then deploys that production resource', async () => {
        const gitCalls: string[] = [];
        const runGit = vi.fn((arguments_: string[]) => {
            gitCalls.push(arguments_.join(' '));
            if (arguments_[0] === 'rev-parse') {
                return releaseSha;
            }
            return '';
        });
        let composeReads = 0;
        const requests: Array<{ body?: unknown; method: string; pathname: string }> = [];
        const fetchImplementation = vi.fn(async (input: FetchInput, init?: RequestInit) => {
            const url = new URL(String(input));
            const method = init?.method ?? 'GET';
            requests.push({
                ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
                method,
                pathname: url.pathname,
            });
            if (url.pathname === '/api/compose.one') {
                composeReads += 1;
                const compose = productionCompose();
                if (composeReads === 2) {
                    return jsonResponse({ ...compose, branch: 'v0.0.1' });
                }
                if (composeReads === 3) {
                    return jsonResponse({
                        ...compose,
                        branch: 'v0.0.1',
                        deployments: [
                            ...compose.deployments,
                            {
                                description: `Commit: ${'b'.repeat(40)}`,
                                deploymentId: 'deployment-external',
                                status: 'done',
                            },
                        ],
                    });
                }
                if (composeReads === 4) {
                    return jsonResponse({
                        ...compose,
                        branch: 'v0.0.1',
                        deployments: [
                            ...compose.deployments,
                            {
                                description: `Commit: ${'b'.repeat(40)}`,
                                deploymentId: 'deployment-external',
                                status: 'done',
                            },
                            {
                                description: `Commit: ${releaseSha}`,
                                deploymentId: 'deployment-new',
                                status: 'done',
                            },
                        ],
                    });
                }
                return jsonResponse(compose);
            }
            if (url.pathname === '/api/compose.update') {
                return jsonResponse({ autoDeploy: false, branch: 'v0.0.1' });
            }
            if (url.pathname === '/api/compose.deploy') {
                return jsonResponse({ composeId: 'compose_prod_123', success: true });
            }
            throw new Error(`Unexpected request: ${method} ${url.href}`);
        });

        await expect(
            deployProduction(source, {
                fetchImplementation,
                runGit,
                waitOptions: { sleep: vi.fn() },
            }),
        ).resolves.toBe('deployment-new');

        expect(gitCalls).toContain(`tag --annotate v0.0.1 ${releaseSha} --message Release v0.0.1`);
        expect(gitCalls).toContain('push origin refs/tags/v0.0.1');
        expect(requests.find(({ pathname }) => pathname === '/api/compose.update')).toMatchObject({
            body: { autoDeploy: false, branch: 'v0.0.1', composeId: 'compose_prod_123' },
        });
        expect(requests.find(({ pathname }) => pathname === '/api/compose.deploy')).toMatchObject({
            body: {
                composeId: 'compose_prod_123',
                description: `Automated production deployment for Shagon1k/PickFlick@${releaseSha} (v0.0.1)`,
                freshVolumes: false,
                title: 'Deploy v0.0.1',
            },
        });
    });

    it('refuses to promote a stale revision after main advances', async () => {
        const runGit = vi.fn((arguments_: string[]) =>
            arguments_[0] === 'rev-parse' ? 'b'.repeat(40) : '',
        );
        const fetchImplementation = vi.fn();

        await expect(deployProduction(source, { fetchImplementation, runGit })).rejects.toThrow(
            /main advanced/,
        );
        expect(fetchImplementation).not.toHaveBeenCalled();
    });

    it('requires manual reconciliation instead of retriggering an already pinned release', async () => {
        const runGit = vi.fn((arguments_: string[]) =>
            arguments_[0] === 'rev-parse' ? releaseSha : '',
        );
        const fetchImplementation = vi.fn(async () =>
            jsonResponse(productionCompose({ branch: 'v0.0.1' })),
        );

        await expect(deployProduction(source, { fetchImplementation, runGit })).rejects.toThrow(
            /Reconcile the previous promotion manually/,
        );
        expect(fetchImplementation).toHaveBeenCalledTimes(1);
        expect(runGit).not.toHaveBeenCalledWith([
            'ls-remote',
            'origin',
            'refs/tags/v0.0.1',
            'refs/tags/v0.0.1^{}',
        ]);
    });
});

describe('production promotion workflow', () => {
    const workflow = readFileSync(resolve('.github/workflows/promote-production.yml'), 'utf8');

    it('is manual and grants write permission only to the guarded production job', () => {
        expect(workflow).toContain('workflow_dispatch:');
        expect(workflow).not.toMatch(/^[ \t]+push:/m);
        expect(workflow).not.toMatch(/^[ \t]+workflow_run:/m);
        expect(workflow).toMatch(/permissions:\n\s{2}actions: read\n\s{2}contents: read/);
        expect(workflow).toMatch(
            /if: \$\{\{ needs\.validate\.outputs\.production_enabled == 'true' \}\}/,
        );
        expect(workflow).toMatch(/environment: production/);
        expect(workflow).toMatch(
            /deploy:[\s\S]*?permissions:\n\s{6}actions: read\n\s{6}contents: write/,
        );
        expect(workflow).toContain(
            'PRODUCTION_DEPLOY_ENABLED: ${{ vars.PRODUCTION_DEPLOY_ENABLED }}',
        );
        expect(workflow).not.toContain(
            'PRODUCTION_DEPLOY_ENABLED: ${{ needs.validate.outputs.production_enabled }}',
        );
    });

    it('runs read-only preparation before the separately guarded deployment controller', () => {
        const prepare = workflow.indexOf('node scripts/promote-production.mjs prepare');
        const guard = workflow.indexOf("needs.validate.outputs.production_enabled == 'true'");
        const deploy = workflow.indexOf('node scripts/promote-production.mjs deploy');

        expect(prepare).toBeGreaterThan(-1);
        expect(guard).toBeGreaterThan(prepare);
        expect(deploy).toBeGreaterThan(guard);
    });
});
