import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const severities = ['info', 'low', 'moderate', 'high', 'critical'];

export function evaluateAudit(raw, status, policy, now = Date.now()) {
    assert.ok(status === 0 || status === 1, `Audit process failed (exit ${status}).`);
    assert.equal(policy.advisory, 'GHSA-vfj7-8cjw-p6xm');
    assert.equal(policy.package, 'braces');
    assert.equal(policy.version, '3.0.3');
    assert.ok(policy.reason?.length > 0, 'Exception needs a reason.');
    assert.ok(now < Date.parse(policy.expires), 'Temporary braces exception expired.');
    const report = JSON.parse(raw);
    assert.ok(report && !report.error && !report.errors, 'Audit transport returned an error.');
    assert.ok(report.advisories && typeof report.advisories === 'object');
    assert.ok(!Array.isArray(report.advisories));
    const counts = report.metadata?.vulnerabilities;
    for (const severity of severities) {
        assert.ok(Number.isSafeInteger(counts?.[severity]) && counts[severity] >= 0);
    }
    const seen = { high: 0, critical: 0 };
    let allowed = 0;
    for (const advisory of Object.values(report.advisories)) {
        assert.ok(severities.includes(advisory.severity), 'Unknown advisory severity.');
        assert.ok(typeof advisory.module_name === 'string');
        assert.ok(Array.isArray(advisory.findings) && advisory.findings.length > 0);
        for (const finding of advisory.findings) {
            assert.ok(typeof finding.version === 'string');
            assert.ok(Array.isArray(finding.paths) && finding.paths.length > 0);
            assert.ok(finding.paths.every((path) => typeof path === 'string' && path.length > 0));
        }
        if (advisory.severity !== 'high' && advisory.severity !== 'critical') {
            continue;
        }
        seen[advisory.severity]++;
        assert.equal(advisory.severity, 'high', 'Critical advisories remain blocking.');
        assert.equal(advisory.github_advisory_id, policy.advisory, 'Unapproved advisory.');
        assert.equal(advisory.module_name, policy.package, 'Unapproved package.');
        assert.equal(advisory.url, `https://github.com/advisories/${policy.advisory}`);
        assert.ok(advisory.findings.every((finding) => finding.version === policy.version));
        allowed++;
    }
    assert.equal(counts.high, seen.high, 'High advisory evidence is incomplete.');
    assert.equal(counts.critical, seen.critical, 'Critical advisory evidence is incomplete.');
    assert.equal(
        status,
        counts.high + counts.critical > 0 ? 1 : 0,
        'Audit exit/evidence mismatch.',
    );
    return allowed;
}

async function addResolverPaths(root, paths) {
    // Inspect actual resolver links, not orphaned caches left by an older patch installation.
    const store = join(root, 'node_modules/.pnpm');
    for (const entry of await readdir(store, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('braces@')) {
            continue;
        }
        const link = join(store, entry.name, 'node_modules/braces');
        try {
            await lstat(link);
        } catch (error) {
            if (error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }
        // A present but broken dependency link must fail, not look like an absent dependency.
        paths.add(await realpath(link));
    }
}

export async function verifyBracesPatch(root, policy, graph) {
    assert.equal(sha256(await readFile(join(root, policy.patch))), policy.patchSha256);
    assert.deepEqual(Object.keys(policy.files).sort(), [
        'index.js',
        'lib/compile.js',
        'lib/constants.js',
        'lib/expand.js',
        'lib/parse.js',
        'lib/stringify.js',
        'lib/utils.js',
        'lib/validate-depth.js',
    ]);
    const paths = new Set();
    const visit = (value) => {
        if (!value || typeof value !== 'object') {
            return;
        }
        if (value.from === 'braces') {
            assert.equal(value.version.split('(')[0], policy.version);
            assert.equal(typeof value.path, 'string');
            paths.add(value.path);
        }
        for (const child of Object.values(value)) {
            visit(child);
        }
    };
    assert.ok(Array.isArray(graph) && graph.length > 0, 'Missing installed dependency graph.');
    visit(graph);
    await addResolverPaths(root, paths);
    assert.ok(paths.size > 0, 'No installed braces packages found.');
    const verified = new Set();
    for (const path of paths) {
        const actual = await realpath(path);
        if (verified.has(actual)) {
            continue;
        }
        const pkg = JSON.parse(await readFile(join(actual, 'package.json'), 'utf8'));
        assert.equal(pkg.name, policy.package);
        assert.equal(pkg.version, policy.version);
        for (const [file, hash] of Object.entries(policy.files)) {
            assert.equal(
                sha256(await readFile(join(actual, file))),
                hash,
                `Unpatched ${actual}/${file}`,
            );
        }
        const require = createRequire(join(actual, 'package.json'));
        const braces = require(actual);
        for (const open of ['{', '(']) {
            const input = open.repeat(101) + 'a,b';
            assert.throws(() => braces.expand(input), {
                name: 'SyntaxError',
                message: 'Input nesting exceeds maximum depth (100)',
            });
        }
        verified.add(actual);
    }
    return verified.size;
}
