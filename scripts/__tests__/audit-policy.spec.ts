import { cp, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { evaluateAudit, verifyBracesPatch } from '../security/audit-policy.mjs';
import policy from '../security/braces-exception.json';

const now = Date.parse('2026-10-04T14:12:45Z');
const advisory = () => ({
    module_name: 'braces',
    severity: 'high',
    github_advisory_id: policy.advisory,
    url: `https://github.com/advisories/${policy.advisory}`,
    findings: [{ version: '3.0.3', paths: ['.>stylelint>micromatch>braces'] }],
});
const report = () => ({
    advisories: { '1240992': advisory() },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
});

describe('audit policy', () => {
    it('should allow only the exact approved advisory before expiry', () => {
        expect(evaluateAudit(JSON.stringify(report()), 1, policy, now)).toBe(1);
    });
    it.each([policy.expires, '2026-11-04T00:00:00Z'])(
        'should fail at or after expiry %s',
        (date) => {
            expect(() =>
                evaluateAudit(JSON.stringify(report()), 1, policy, Date.parse(date)),
            ).toThrow('expired');
        },
    );
    it.each([null, 2, 127])('should preserve unexpected process failure %s', (status) => {
        expect(() => evaluateAudit(JSON.stringify(report()), status, policy, now)).toThrow();
    });
    it.each(['', '{', '{}', '{"error":"registry unavailable"}', '{"advisories":[]}'])(
        'should reject malformed evidence %s',
        (raw) => {
            expect(() => evaluateAudit(raw, 1, policy, now)).toThrow();
        },
    );
    it.each([
        { module_name: 'different' },
        { github_advisory_id: 'GHSA-unapproved' },
        { severity: 'critical' },
        { severity: 'unknown' },
        { findings: [{ version: '3.0.2', paths: ['.>braces'] }] },
        { findings: [{ version: '3.0.3', paths: [] }] },
        { findings: [] },
        { url: 'https://example.invalid/advisory' },
    ])('should reject mismatched advisory %#', (change) => {
        const evidence = report();
        Object.assign(evidence.advisories['1240992'], change);
        expect(() => evaluateAudit(JSON.stringify(evidence), 1, policy, now)).toThrow();
    });
    it('should reject an additional high advisory, including the same package', () => {
        const evidence = report();
        const raw = JSON.stringify({
            ...evidence,
            advisories: {
                ...evidence.advisories,
                other: { ...advisory(), github_advisory_id: 'GHSA-new' },
            },
        });
        expect(() => evaluateAudit(raw, 1, policy, now)).toThrow();
    });
    it('should fail when high or critical findings are absent from raw evidence', () => {
        for (const severity of ['high', 'critical'] as const) {
            const evidence = report();
            evidence.metadata.vulnerabilities[severity]++;
            expect(() => evaluateAudit(JSON.stringify(evidence), 1, policy, now)).toThrow(
                'incomplete',
            );
        }
    });
    it('should reject mismatched exit status even with valid JSON', () => {
        expect(() => evaluateAudit(JSON.stringify(report()), 0, policy, now)).toThrow('mismatch');
    });
    it('should keep lower severities visible without blocking them', () => {
        const low = { ...advisory(), severity: 'moderate', github_advisory_id: 'GHSA-other' };
        const evidence = {
            advisories: { low },
            metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0 } },
        };
        expect(evaluateAudit(JSON.stringify(evidence), 0, policy, now)).toBe(0);
    });
    it('should reject invalid expiry or an empty exception reason', () => {
        expect(() =>
            evaluateAudit(JSON.stringify(report()), 1, { ...policy, expires: 'invalid' }, now),
        ).toThrow();
        expect(() =>
            evaluateAudit(JSON.stringify(report()), 1, { ...policy, reason: '' }, now),
        ).toThrow();
    });
});

describe('installed patch verification', () => {
    it('should independently reject patch, installed source and package identity tampering', async () => {
        const root = await mkdtemp(join(tmpdir(), 'pickflick-patch-test-'));
        try {
            const store = resolve('node_modules/.pnpm');
            const entry = (await readdir(store)).find(
                (name) => name === `braces@3.0.3_patch_hash=${policy.patchSha256}`,
            );
            if (!entry) {
                throw new Error('Missing installed braces.');
            }
            const destination = join(root, 'node_modules/.pnpm', entry, 'node_modules/braces');
            await cp(join(store, entry, 'node_modules/braces'), destination, { recursive: true });
            await symlink(
                join(store, entry, 'node_modules/fill-range'),
                join(destination, '../fill-range'),
            );
            await cp(resolve('patches'), join(root, 'patches'), { recursive: true });
            // Use the real graph shape, not fabricated audit findings, for isolated tamper tests.
            const graph = [
                {
                    dependencies: {
                        braces: { from: 'braces', version: '3.0.3', path: destination },
                    },
                },
            ];
            expect(await verifyBracesPatch(root, policy, graph)).toBe(1);
            const parsePath = join(destination, 'lib/parse.js');
            const parse = await readFile(parsePath, 'utf8');
            await writeFile(parsePath, parse + '\n// tampered\n');
            await expect(verifyBracesPatch(root, policy, graph)).rejects.toThrow('Unpatched');
            await writeFile(parsePath, parse);
            await writeFile(join(root, policy.patch), 'invalid patch');
            await expect(verifyBracesPatch(root, policy, graph)).rejects.toThrow();
            await cp(resolve(policy.patch), join(root, policy.patch));
            const pkgPath = join(destination, 'package.json');
            await writeFile(pkgPath, JSON.stringify({ name: 'braces', version: '3.0.4' }));
            await expect(verifyBracesPatch(root, policy, graph)).rejects.toThrow();
            await expect(verifyBracesPatch(root, policy, [])).rejects.toThrow();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
