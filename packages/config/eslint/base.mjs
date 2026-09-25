import eslint from '@eslint/js';
import reactPlugin from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
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
        files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
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
        files: ['tests/ui-preview/**', 'scripts/ui-preview-smoke.mjs'],
        rules: {
            'sonarjs/no-networkidle-wait': 'off',
        },
    },
    {
        // Developer and CI tooling deliberately resolves pnpm, docker, and git from PATH.
        files: [
            'scripts/**',
            'packages/database/src/reset.ts',
            'packages/database/src/run-prisma.ts',
        ],
        rules: {
            'sonarjs/no-os-command-from-path': 'off',
        },
    },
    // Disables formatting rules that Prettier owns; always last.
    prettier,
];
