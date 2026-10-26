import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AREAS = [
    {
        source: /^(?:apps\/frontend\/src\/app\/\(marketing\)\/|apps\/frontend\/src\/api\/contact\.server\.ts$)/,
        tests: /^public-pages\.spec\.ts$/,
        captures: /^(?:landing|pricing|contact|privacy|terms)-/,
    },
    {
        source: /^apps\/frontend\/src\/app\/\(auth\)\//,
        tests: /^auth\.spec\.ts$/,
        captures: /^login-/,
    },
    {
        source: /^(?:apps\/frontend\/src\/app\/\(product\)\/clubs\/|apps\/frontend\/src\/api\/(?:clubs|invitations)\.server\.ts$)/,
        tests: /^(?:club-.+|achievements|phase-states-visual)\.spec\.ts$/,
        captures: /^(?:club-|create-club-|no-clubs-|pending-invites-|hub-history-)/,
    },
    {
        source: /^(?:apps\/frontend\/src\/app\/\(product\)\/sessions\/|apps\/frontend\/src\/components\/sessions\/|apps\/frontend\/src\/api\/(?:sessions?|session-roster|nominations|selection|rating)\.server\.ts$)/,
        tests: /^(?:session-.+|nominations|selection(?:-outcome)?|watching|rating|completed-history|club-hub|phase-states-visual)\.spec\.ts$/,
        captures: /^(?:create-session|nominations|selection|watching|rating|completed-history)-/,
    },
    {
        source: /^(?:apps\/frontend\/src\/app\/\(product\)\/movies\/|apps\/frontend\/src\/api\/movies\.server\.ts$)/,
        tests: /^(?:movie-.+|personal-rating|watchlist|phase-states-visual)\.spec\.ts$/,
        captures: /^(?:movie-details|personal-rating)-/,
    },
    {
        source: /^(?:apps\/frontend\/src\/app\/\(product\)\/library\/|apps\/frontend\/src\/components\/achievements\/|apps\/frontend\/src\/api\/(?:library|achievements|personal-rating|watchlist)\.server\.ts$)/,
        tests: /^(?:library(?:-statistics)?|achievements|personal-rating|watchlist|movie-details|club-ratings|phase-states-visual)\.spec\.ts$/,
        captures: /^(?:library|achievements|watchlist)-/,
    },
];

// null selects the full suite; an empty list means the changes do not affect the mock UI.
export function selectUiFiles(paths, testFiles) {
    const selected = new Set();
    for (const path of paths) {
        if (path.startsWith('tests/ui/') && testFiles.includes(path)) {
            selected.add(path);
            continue;
        }
        const area = AREAS.find(
            ({ source, captures }) =>
                source.test(path) ||
                (path.startsWith('tests/ui/__screenshots__/') &&
                    captures.test(path.split('/').at(-1))),
        );
        if (area) {
            testFiles
                .filter((file) => area.tests.test(file.slice('tests/ui/'.length)))
                .forEach((file) => selected.add(file));
            continue;
        }
        if (
            /^(?:apps\/frontend\/|tests\/ui\/|packages\/(?:contracts|config)\/|assets\/brand\/)/.test(
                path,
            ) ||
            /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.node-version|playwright\.ui\.config\.ts|\.github\/workflows\/ci\.yml|scripts\/run-ui-checks\.mjs)$/.test(
                path,
            )
        ) {
            return null;
        }
    }
    return [...selected].sort();
}

function runUiChecks() {
    const [suite, base] = process.argv.slice(2);
    const testFiles = readdirSync('tests/ui')
        .filter((file) => file.endsWith('.spec.ts'))
        .map((file) => `tests/ui/${file}`);
    const files = base
        ? selectUiFiles(
              // The CI container user differs from the checkout owner; trust only this checkout.
              execFileSync(
                  'git',
                  [
                      '-c',
                      `safe.directory=${resolve('.')}`,
                      'diff',
                      '--name-only',
                      '-z',
                      `${base}...HEAD`,
                  ],
                  { encoding: 'utf8' },
              )
                  .split('\0')
                  .filter(Boolean),
              testFiles,
          )
        : null;
    if (files?.length === 0) {
        console.log('No mock UI changes; UI checks are not needed.');
        return;
    }
    console.log(`UI ${suite}: ${files ? files.join(', ') : 'full suite'}`);
    const result = spawnSync(
        'pnpm',
        [`test:ui:${suite}`, ...(files ? [...files, '--pass-with-no-tests'] : [])],
        { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    runUiChecks();
}
