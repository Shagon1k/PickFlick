import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const advisoryId = 'GHSA-fc5q-39xc-vjpf';
const approvedAt = '2026-11-18T13:50:54Z';
const expiresAt = '2026-12-18T13:50:54Z';
const severities = ['info', 'low', 'moderate', 'high', 'critical'];

/** @param {unknown} value @returns {value is Record<string, any>} */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function isText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/** @param {unknown} condition @param {string} message @returns {asserts condition} */
function requireEvidence(condition, message) {
    if (!condition) throw new Error(message);
}

/** @param {string} key @param {unknown} advisory @returns {asserts advisory is Record<string, any>} */
function validateAdvisory(key, advisory) {
    requireEvidence(
        isRecord(advisory) &&
            Number.isSafeInteger(advisory.id) &&
            advisory.id > 0 &&
            String(advisory.id) === key &&
            isText(advisory.module_name) &&
            /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(advisory.module_name) &&
            typeof advisory.github_advisory_id === 'string' &&
            /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/.test(
                advisory.github_advisory_id,
            ) &&
            advisory.url === `https://github.com/advisories/${advisory.github_advisory_id}` &&
            severities.includes(advisory.severity) &&
            Array.isArray(advisory.findings) &&
            advisory.findings.length > 0,
        `Malformed advisory evidence: ${key}.`,
    );
    for (const finding of advisory.findings) {
        requireEvidence(
            isRecord(finding) &&
                typeof finding.version === 'string' &&
                /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(finding.version) &&
                finding.dev === false &&
                typeof finding.optional === 'boolean' &&
                typeof finding.bundled === 'boolean' &&
                Array.isArray(finding.paths) &&
                finding.paths.length > 0 &&
                finding.paths.every(
                    (path) =>
                        typeof path === 'string' &&
                        path.endsWith(`>${advisory.module_name}`) &&
                        path
                            .split('>')
                            .every((part) => /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(part)),
                ),
            `Malformed finding evidence: ${key}.`,
        );
    }
}

/** @param {unknown} policy @param {number} now */
function validatePolicy(policy, now) {
    requireEvidence(isRecord(policy), 'Invalid exception policy.');
    requireEvidence(
        Object.keys(policy).sort().join(',') ===
            'advisory,approvedAt,expiresAt,owner,package,reason,severity,versions' &&
            policy.package === 'picomatch' &&
            policy.advisory === advisoryId &&
            policy.severity === 'high' &&
            Array.isArray(policy.versions) &&
            policy.versions.length === 1 &&
            policy.versions[0] === '4.0.7' &&
            policy.approvedAt === approvedAt &&
            policy.expiresAt === expiresAt &&
            policy.owner === 'Alex' &&
            isText(policy.reason),
        'Exception policy differs from the exact owner-approved unpatched risk acceptance.',
    );
    requireEvidence(
        Number.isFinite(now) && now >= Date.parse(approvedAt) && now < Date.parse(expiresAt),
        `Exception is not active or has expired (${expiresAt}); remove or explicitly reapprove it.`,
    );
}

/** @param {string} stdout */
function parseAudit(stdout) {
    const audit = JSON.parse(stdout);
    requireEvidence(
        isRecord(audit) &&
            !Object.hasOwn(audit, 'error') &&
            isRecord(audit.advisories) &&
            isRecord(audit.metadata) &&
            isRecord(audit.metadata.vulnerabilities),
        'Invalid audit JSON schema or registry error.',
    );
    const counts = audit.metadata.vulnerabilities;
    requireEvidence(
        Object.keys(counts).sort().join(',') === [...severities].sort().join(',') &&
            severities.every(
                (severity) => Number.isSafeInteger(counts[severity]) && counts[severity] >= 0,
            ),
        'Invalid vulnerability severity counts.',
    );
    return audit;
}

/**
 * Pure evaluation of audit evidence. Throws on missing or inconsistent evidence.
 * Lower-severity metadata includes advisories omitted by pnpm's high-level filter.
 * @param {{ stdout: string, stderr: string, status: number | null, signal: string | null, error?: unknown }} result
 * @param {unknown} policy
 * @param {number} [now]
 */
export function evaluateAudit(result, policy, now = Date.now()) {
    validatePolicy(policy, now);
    requireEvidence(
        (result.error === undefined || result.error === null) &&
            typeof result.stderr === 'string' &&
            result.stderr.trim() === '' &&
            result.signal === null &&
            (result.status === 0 || result.status === 1),
        'Audit subprocess failed: transport error, signal, or unexpected exit status.',
    );
    const audit = parseAudit(result.stdout);
    const counts = audit.metadata.vulnerabilities;
    const actual = Object.fromEntries(severities.map((severity) => [severity, 0]));
    const identities = new Set();
    const blocked = [];
    let accepted = 0;
    for (const [key, advisory] of Object.entries(audit.advisories)) {
        validateAdvisory(key, advisory);
        requireEvidence(
            !identities.has(advisory.github_advisory_id),
            'Duplicate advisory identity.',
        );
        identities.add(advisory.github_advisory_id);
        actual[advisory.severity] += 1;
        if (advisory.severity !== 'high' && advisory.severity !== 'critical') continue;
        if (
            advisory.github_advisory_id === advisoryId &&
            advisory.module_name === 'picomatch' &&
            advisory.severity === 'high' &&
            advisory.findings.every((finding) => finding.version === '4.0.7')
        ) {
            accepted += 1;
        } else {
            blocked.push(`${advisory.github_advisory_id} ${advisory.module_name}`);
        }
    }
    requireEvidence(
        actual.high === counts.high &&
            actual.critical === counts.critical &&
            severities.every((severity) => actual[severity] <= counts[severity]),
        'Audit metadata does not match advisory evidence.',
    );
    requireEvidence(
        result.status === (counts.high + counts.critical > 0 ? 1 : 0),
        'Audit exit status does not match high/critical evidence.',
    );
    requireEvidence(
        blocked.length === 0,
        `Unaccepted high/critical advisories: ${blocked.join(', ')}.`,
    );
    return [
        accepted > 0
            ? `WARNING: accepted UNPATCHED risk: ${advisoryId} picomatch@4.0.7 (high); UTC expiry ${expiresAt}. This is not a fix.`
            : 'No high/critical advisories reported; the active exception must still be removed before expiry.',
        `Audit metadata: info=${counts.info}, low=${counts.low}, moderate=${counts.moderate}, high=${counts.high}, critical=${counts.critical}.`,
    ];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const result = spawnSync('pnpm', ['audit', '--prod', '--audit-level', 'high', '--json'], {
        cwd: repositoryRoot,
        shell: false,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
    });
    // Preserve both original streams before policy loading, parsing, or interpretation.
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    try {
        const policy = JSON.parse(
            readFileSync(new URL('./security-audit-exceptions.json', import.meta.url), 'utf8'),
        );
        for (const message of evaluateAudit(result, policy)) console.error(`\n${message}`);
    } catch (error) {
        console.error('\nSecurity audit BLOCKED:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
