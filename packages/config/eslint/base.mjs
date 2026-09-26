import eslint from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import checkFile from 'eslint-plugin-check-file';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactConfig = reactPlugin.configs['recommended-typescript'];

const noReadonlyWrapper = {
    selector: "TSTypeReference[typeName.name='Readonly']",
    message: 'Write plain types; props and data are not wrapped in Readonly<>.',
};

export default [
    {
        // A disable directive that no longer suppresses anything fails the lint.
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
    {
        ignores: [
            '**/.next/**',
            '**/coverage/**',
            '**/dist/**',
            '**/generated/**',
            '**/node_modules/**',
            '**/test-results/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // The rules SonarQube for IDE reports, so the editor, hooks, and CI agree.
    sonarjs.configs.recommended,
    {
        files: ['**/*.{js,mjs,ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            curly: ['error', 'all'],
            'no-duplicate-imports': 'error',
            // A file past 300 lines holds more than one idea; split it.
            'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
        },
    },
    {
        // A spec is a flat list of independent cases, so it gets more room before it must split.
        files: ['**/__tests__/**', 'tests/**'],
        rules: {
            'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
        },
    },
    {
        // House style from .agent-docs/rules/typescript.md, enforced so every agent writes alike.
        files: ['**/*.{ts,tsx}'],
        plugins: { 'check-file': checkFile, 'simple-import-sort': simpleImportSort },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            '@typescript-eslint/naming-convention': [
                'error',
                { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
                { selector: 'typeAlias', format: ['PascalCase'], prefix: ['T'] },
            ],
            'no-restricted-syntax': ['error', noReadonlyWrapper],
            'check-file/filename-naming-convention': [
                'error',
                { '**/__tests__/**/*.{ts,tsx}': '*.?(int.)spec' },
                { ignoreMiddleExtensions: false },
            ],
        },
    },
    {
        files: ['apps/frontend/**/*.{ts,tsx}'],
        rules: {
            // Restating the rule replaces the shared entry, so the Readonly ban is listed again.
            'no-restricted-syntax': [
                'error',
                noReadonlyWrapper,
                {
                    selector: 'ExportNamedDeclaration > FunctionDeclaration[id.name=/^[A-Z]/]',
                    message:
                        'Export a component as the default export of its own file (export default function Name).',
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['@mantine/*', '!@mantine/form'],
                            message: 'Use the UI kit in @/components/ui; only it imports Mantine.',
                        },
                        {
                            group: ['../../../*'],
                            message: 'Import through the @/ alias instead of a deep relative path.',
                        },
                    ],
                },
            ],
            // components/<group>/<Name>/<Name>.tsx: one PascalCase folder per component, inside a
            // group listed in ignoreWords (the rule would otherwise check the group name too).
            'check-file/folder-naming-convention': [
                'error',
                {
                    'apps/frontend/src/components/*/': 'KEBAB_CASE',
                    'apps/frontend/src/components/*/!(__tests__)/': 'PASCAL_CASE',
                },
                { ignoreWords: ['clubs', 'navigation', 'shells', 'ui'] },
            ],
        },
    },
    {
        // The UI kit and theme own Mantine; tests may reach files outside src such as next.config.
        files: [
            'apps/frontend/src/components/ui/**',
            'apps/frontend/src/theme/**',
            'apps/frontend/**/__tests__/**',
        ],
        rules: { 'no-restricted-imports': 'off' },
    },
    {
        files: ['apps/frontend/**/*.{ts,tsx}'],
        ...reactConfig,
        languageOptions: {
            ...reactConfig.languageOptions,
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            ...reactConfig.plugins,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            ...reactConfig.rules,
            ...reactHooksPlugin.configs.recommended.rules,
        },
    },
    {
        rules: {
            // exactOptionalPropertyTypes needs `?: T | undefined` to accept an explicit undefined.
            'sonarjs/no-redundant-optional': 'off',
        },
    },
    {
        // Tests and local tooling talk to loopback and synthetic hosts over plain HTTP.
        files: ['**/__tests__/**', 'tests/**', 'scripts/**'],
        rules: {
            'sonarjs/no-clear-text-protocols': 'off',
            'sonarjs/no-hardcoded-ip': 'off',
        },
    },
    {
        // Screenshot and accessibility checks need every resource settled before they capture.
        files: ['tests/ui-preview/**'],
        rules: {
            'sonarjs/no-networkidle-wait': 'off',
        },
    },
    {
        // Developer and CI tooling deliberately resolves pnpm, docker, and git from PATH.
        files: ['scripts/**', 'packages/database/src/cli/**'],
        rules: {
            'sonarjs/no-os-command-from-path': 'off',
        },
    },
    // Disables formatting rules that Prettier owns; always last.
    prettier,
];
