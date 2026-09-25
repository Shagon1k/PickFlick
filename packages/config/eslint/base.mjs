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

export default [
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
            // Soft guard against god-files: a signal to decompose, not a hard block.
            'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
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
            'no-restricted-syntax': [
                'error',
                {
                    selector: "TSTypeReference[typeName.name='Readonly']",
                    message: 'Write plain types; props and data are not wrapped in Readonly<>.',
                },
            ],
            'check-file/filename-naming-convention': [
                'error',
                { '**/__tests__/**/*.{ts,tsx}': '*.?(int.)spec' },
                { ignoreMiddleExtensions: false },
            ],
        },
    },
    {
        files: ['apps/web/**/*.{ts,tsx}'],
        rules: {
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
            'check-file/folder-naming-convention': [
                'error',
                { 'apps/web/src/components/ui/*/': 'PASCAL_CASE' },
            ],
        },
    },
    {
        // The UI kit and theme own Mantine; tests may reach files outside src such as next.config.
        files: [
            'apps/web/src/components/ui/**',
            'apps/web/src/theme/**',
            'apps/web/**/__tests__/**',
        ],
        rules: { 'no-restricted-imports': 'off' },
    },
    {
        files: ['apps/web/**/*.{ts,tsx}'],
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
