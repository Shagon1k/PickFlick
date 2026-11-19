import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateAudit } from '../security-audit.mjs';

const policy = JSON.parse(
    readFileSync(new URL('../security-audit-exceptions.json', import.meta.url), 'utf8'),
) as { approvedAt: string; expiresAt: string };
const now = Date.parse('2026-11-19T00:00:00Z');

// Synthetic fixtures only: these test validation, not live registry or runtime safety evidence.
function syntheticAudit() {
    return {
        advisories: {
            '1247710': {
                id: 1247710,
                github_advisory_id: 'GHSA-fc5q-39xc-vjpf',
                url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
                module_name: 'picomatch',
                severity: 'high',
                findings: [
                    {
                        version: '4.0.7',
                        paths: ['app>parent>picomatch'],
                        dev: false,
                        optional: true,
                        bundled: false,
                    },
                ],
            },
        },
        metadata: { vulnerabilities: { info: 0, low: 2, moderate: 8, high: 1, critical: 0 } },
    };
}

type TAudit = ReturnType<typeof syntheticAudit>;

function result(audit: unknown = syntheticAudit(), status = 1) {
    return { stdout: JSON.stringify(audit), stderr: '', status, signal: null };
}

function cleanAudit() {
    return {
        advisories: {},
        metadata: { vulnerabilities: { info: 0, low: 2, moderate: 8, high: 0, critical: 0 } },
    };
}

describe('security audit (synthetic fixtures)', () => {
    it('should accept only the unpatched approved finding and preserve lower-severity counts', () => {
        const messages = evaluateAudit(result(), policy, now).join('\n');

        expect(messages).toContain(
            'WARNING: accepted UNPATCHED risk: GHSA-fc5q-39xc-vjpf picomatch@4.0.7',
        );
        expect(messages).toContain('UTC expiry 2026-12-18T13:50:54Z');
        expect(messages).toContain('low=2, moderate=8, high=1');
        expect(messages).not.toMatch(/no vulnerabilities/i);
    });

    it('should accept the inclusive approval boundary but reject the exclusive expiry boundary', () => {
        expect(() => evaluateAudit(result(), policy, Date.parse(policy.approvedAt))).not.toThrow();
        expect(() => evaluateAudit(result(), policy, Date.parse(policy.approvedAt) - 1)).toThrow(
            /not active/,
        );
        expect(() =>
            evaluateAudit(result(), policy, Date.parse(policy.expiresAt) - 1),
        ).not.toThrow();
        expect(() => evaluateAudit(result(), policy, Date.parse(policy.expiresAt))).toThrow(
            /expired/,
        );
        expect(() => evaluateAudit(result(), policy, NaN)).toThrow(/not active/);
    });

    it('should reject expired policy even when the advisory disappears', () => {
        expect(() =>
            evaluateAudit(result(cleanAudit(), 0), policy, Date.parse(policy.expiresAt)),
        ).toThrow(/expired/);
        expect(evaluateAudit(result(cleanAudit(), 0), policy, now).join('\n')).toContain(
            'must still be removed',
        );
    });

    it.each([
        null,
        {},
        { ...policy, expiresAt: 'invalid' },
        { ...policy, expiresAt: '2026-12-19T13:50:54Z' },
        { ...policy, approvedAt: '2026-11-17T13:50:54Z' },
        { ...policy, package: 'other' },
        { ...policy, advisory: 'GHSA-xxxx-xxxx-xxxx' },
        { ...policy, severity: 'critical' },
        { ...policy, versions: ['4.0.7', '4.0.8'] },
        { ...policy, owner: '' },
        { ...policy, reason: '' },
        { ...policy, ignoreAll: true },
    ])(
        'should reject malformed or broadened policy %# even with zero findings',
        (invalidPolicy) => {
            expect(() => evaluateAudit(result(cleanAudit(), 0), invalidPolicy, now)).toThrow(
                /policy/i,
            );
        },
    );

    const mutations: [string, (audit: TAudit) => void][] = [
        [
            'wrong version',
            (a) => {
                a.advisories['1247710'].findings[0]!.version = '4.0.8';
            },
        ],
        [
            'mixed versions',
            (a) => {
                a.advisories['1247710'].findings.push({
                    ...a.advisories['1247710'].findings[0]!,
                    version: '4.0.6',
                });
            },
        ],
        [
            'wrong module',
            (a) => {
                a.advisories['1247710'].module_name = 'other';
            },
        ],
        [
            'wrong advisory',
            (a) => {
                a.advisories['1247710'].github_advisory_id = 'GHSA-xxxx-xxxx-xxxx';
                a.advisories['1247710'].url = 'https://github.com/advisories/GHSA-xxxx-xxxx-xxxx';
            },
        ],
        [
            'wrong URL',
            (a) => {
                a.advisories['1247710'].url = 'https://example.com';
            },
        ],
        [
            'wrong numeric ID',
            (a) => {
                a.advisories['1247710'].id = 9;
            },
        ],
        [
            'unknown severity',
            (a) => {
                a.advisories['1247710'].severity = 'urgent';
            },
        ],
        [
            'critical severity',
            (a) => {
                a.advisories['1247710'].severity = 'critical';
                a.metadata.vulnerabilities.high = 0;
                a.metadata.vulnerabilities.critical = 1;
            },
        ],
        [
            'no findings',
            (a) => {
                a.advisories['1247710'].findings = [];
            },
        ],
        [
            'no paths',
            (a) => {
                a.advisories['1247710'].findings[0]!.paths = [];
            },
        ],
        [
            'empty path',
            (a) => {
                a.advisories['1247710'].findings[0]!.paths = [''];
            },
        ],
        [
            'wrong path target',
            (a) => {
                a.advisories['1247710'].findings[0]!.paths = ['app>other'];
            },
        ],
        [
            'empty path segment',
            (a) => {
                a.advisories['1247710'].findings[0]!.paths = ['app>>picomatch'];
            },
        ],
        [
            'whitespace path',
            (a) => {
                a.advisories['1247710'].findings[0]!.paths = [' >picomatch'];
            },
        ],
        [
            'malformed version',
            (a) => {
                a.advisories['1247710'].findings[0]!.version = '';
            },
        ],
        [
            'dev-only evidence',
            (a) => {
                a.advisories['1247710'].findings[0]!.dev = true;
            },
        ],
        [
            'metadata undercount',
            (a) => {
                a.metadata.vulnerabilities.high = 0;
            },
        ],
        [
            'metadata overcount',
            (a) => {
                a.metadata.vulnerabilities.high = 2;
            },
        ],
        [
            'critical evidence missing',
            (a) => {
                a.metadata.vulnerabilities.critical = 1;
            },
        ],
        [
            'negative metadata',
            (a) => {
                a.metadata.vulnerabilities.low = -1;
            },
        ],
        [
            'fractional metadata',
            (a) => {
                a.metadata.vulnerabilities.low = 0.5;
            },
        ],
    ];
    it.each(mutations)('should block %s', (_name, mutate) => {
        const audit = syntheticAudit();
        mutate(audit);

        expect(() => evaluateAudit(result(audit), policy, now)).toThrow();
    });

    it.each(['high', 'critical'])('should block an additional %s advisory', (severity) => {
        const audit = syntheticAudit();
        const additional = {
            ...audit.advisories['1247710'],
            id: 99,
            github_advisory_id: 'GHSA-xxxx-xxxx-xxxx',
            url: 'https://github.com/advisories/GHSA-xxxx-xxxx-xxxx',
            severity,
        };
        const evidence = { ...audit, advisories: { ...audit.advisories, '99': additional } };
        if (severity === 'high') evidence.metadata.vulnerabilities.high += 1;
        else evidence.metadata.vulnerabilities.critical += 1;

        expect(() => evaluateAudit(result(evidence), policy, now)).toThrow(/Unaccepted/);
    });

    it.each([
        {},
        [],
        null,
        { error: 'registry failure' },
        { ...syntheticAudit(), advisories: [] },
        { ...syntheticAudit(), advisories: { '1247710': null } },
        { ...syntheticAudit(), metadata: { vulnerabilities: { high: 1, critical: 0 } } },
        {
            ...syntheticAudit(),
            metadata: {
                vulnerabilities: { ...syntheticAudit().metadata.vulnerabilities, unknown: 0 },
            },
        },
        {
            ...syntheticAudit(),
            metadata: {
                vulnerabilities: { ...syntheticAudit().metadata.vulnerabilities, high: '1' },
            },
        },
    ])('should reject malformed audit schema %#', (audit) => {
        expect(() => evaluateAudit(result(audit), policy, now)).toThrow();
    });

    it.each([
        { status: 0 },
        { status: 2 },
        { status: null },
        { signal: 'SIGTERM' },
        { error: new Error('ETIMEDOUT') },
        { stderr: 'ERR_PNPM_AUDIT_BAD_RESPONSE' },
        { stdout: '{broken JSON' },
        { stdout: '' },
    ])('should reject subprocess or JSON failure %#', (override) => {
        expect(() => evaluateAudit({ ...result(), ...override }, policy, now)).toThrow();
    });

    it.each([
        null,
        {},
        { version: '4.0.7', paths: ['app>picomatch'] },
        { version: '4.0.7', paths: [null], dev: false, optional: true, bundled: false },
        {
            version: '4.0.7',
            paths: ['app>picomatch'],
            dev: false,
            optional: 'true',
            bundled: false,
        },
    ])('should reject malformed finding fields %#', (finding) => {
        const audit = syntheticAudit();
        const evidence = {
            ...audit,
            advisories: { '1247710': { ...audit.advisories['1247710'], findings: [finding] } },
        };

        expect(() => evaluateAudit(result(evidence), policy, now)).toThrow(/finding evidence/);
    });

    it('should reject duplicate advisory identities', () => {
        const audit = syntheticAudit();
        const evidence = {
            ...audit,
            advisories: { ...audit.advisories, '99': { ...audit.advisories['1247710'], id: 99 } },
        };
        evidence.metadata.vulnerabilities.high = 2;

        expect(() => evaluateAudit(result(evidence), policy, now)).toThrow(/Duplicate advisory/);
    });

    it('should reject a nonzero exit without high/critical evidence', () => {
        expect(() => evaluateAudit(result(cleanAudit(), 1), policy, now)).toThrow(/exit status/);
    });

    it('should retain valid reported lower-severity findings without exempting them', () => {
        const audit = syntheticAudit();
        audit.advisories['1247710'].severity = 'low';
        audit.metadata.vulnerabilities.high = 0;

        expect(evaluateAudit(result(audit, 0), policy, now).join('\n')).toContain('low=2');
    });
});

describe('security audit CLI (synthetic subprocess, no registry request)', () => {
    it('should use exact arguments and repository cwd and emit raw streams before blocking', () => {
        const root = mkdtempSync(join(tmpdir(), 'pickflick-audit-'));
        try {
            mkdirSync(join(root, 'scripts'));
            mkdirSync(join(root, 'bin'));
            copyFileSync(
                fileURLToPath(new URL('../security-audit.mjs', import.meta.url)),
                join(root, 'scripts/security-audit.mjs'),
            );
            // Invalid policy proves even policy-load failures retain the raw subprocess evidence.
            writeFileSync(join(root, 'scripts/security-audit-exceptions.json'), '{invalid');
            writeFileSync(
                join(root, 'bin/pnpm'),
                `#!/usr/bin/env node\nprocess.stdout.write('SYNTHETIC raw audit ' + JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));\nprocess.stderr.write('SYNTHETIC raw stderr');\nprocess.exitCode=1;\n`,
                { mode: 0o755 },
            );

            const child = spawnSync(process.execPath, [join(root, 'scripts/security-audit.mjs')], {
                cwd: tmpdir(),
                env: {
                    ...process.env,
                    PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH}`,
                },
                encoding: 'utf8',
                timeout: 10_000,
            });

            expect(child.status).toBe(1);
            expect(child.stdout).toBe(
                `SYNTHETIC raw audit ${JSON.stringify({ args: ['audit', '--prod', '--audit-level', 'high', '--json'], cwd: root })}`,
            );
            expect(child.stderr).toMatch(/^SYNTHETIC raw stderr\nSecurity audit BLOCKED:/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
